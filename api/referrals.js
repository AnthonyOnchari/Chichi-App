import admin from 'firebase-admin';
import { randomInt } from 'node:crypto';

const REWARD_PER_REFERRAL = 10;
const MINIMUM_WITHDRAWAL = 50;
const REFERRAL_CLAIM_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ADMINS = ['support@chichi.buzz', 'support-chichi@gmail.com', 'onchari.dev@gmail.com'];
const DATABASE_URL = 'https://chichi-001-default-rtdb.firebaseio.com';

function getFirebaseAdmin() {
    if (!admin.apps.length) {
        let serviceAccount;
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
        } catch (error) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON');
        }
        if (!serviceAccount.project_id || !serviceAccount.private_key) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
        }
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: DATABASE_URL
        });
    }
    return admin;
}

async function authenticate(firebaseAdmin, req) {
    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) {
        const error = new Error('Authentication required');
        error.statusCode = 401;
        throw error;
    }
    try {
        return await firebaseAdmin.auth().verifyIdToken(authorization.slice(7), true);
    } catch (error) {
        const authError = new Error('Your session has expired. Sign in again.');
        authError.statusCode = 401;
        throw authError;
    }
}

async function requireAdmin(firebaseAdmin, user) {
    const email = String(user.email || '').toLowerCase();
    if (DEFAULT_ADMINS.indexOf(email) !== -1) return;
    const encodedEmail = email.replace(/\./g, '_');
    const snapshot = await firebaseAdmin.database().ref('adminUsers/' + encodedEmail).once('value');
    if (!snapshot.val()) {
        const error = new Error('Administrator access required');
        error.statusCode = 403;
        throw error;
    }
}

async function getReferralWallet(firebaseAdmin, uid) {
    const database = firebaseAdmin.database();
    const ref = database.ref('referralAccounts/' + uid);
    const snapshot = await ref.once('value');
    return { ref: ref, wallet: snapshot.val() || {} };
}

function enrollmentStatus(wallet) {
    return {
        enrolled: wallet.enrollmentDecision === 'accepted' || Boolean(wallet.enrolledAt),
        declined: wallet.enrollmentDecision === 'declined',
        needsConsent: wallet.enrollmentDecision !== 'accepted' && !wallet.enrolledAt && wallet.enrollmentDecision !== 'declined',
        code: wallet.enrollmentDecision === 'accepted' || wallet.enrolledAt ? wallet.code || '' : ''
    };
}

async function enrollReferral(firebaseAdmin, user) {
    const database = firebaseAdmin.database();
    const walletRef = database.ref('referralAccounts/' + user.uid);
    const existing = await walletRef.once('value');
    const existingWallet = existing.val() || {};
    let code = existingWallet.code || '';

    if (!code) {
        const username = String(user.username || (user.email || '').split('@')[0] || 'chichi')
            .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30) || 'CHICHI';
        let reserved = false;
        for (let attempt = 0; attempt < 30 && !reserved; attempt += 1) {
            const suffix = String(randomInt(0, 1000)).padStart(3, '0');
            const candidate = username + suffix;
            const ownership = await database.ref('referralCodeOwners/' + candidate).transaction(function(ownerUid) {
                return ownerUid == null || ownerUid === user.uid ? user.uid : undefined;
            });
            if (ownership.committed) {
                code = candidate;
                reserved = true;
            }
        }
        if (!reserved) {
            const error = new Error('Could not reserve a unique referral code. Please try again.');
            error.statusCode = 503;
            throw error;
        }
    } else {
        const ownership = await database.ref('referralCodeOwners/' + code).transaction(function(ownerUid) {
            return ownerUid == null || ownerUid === user.uid ? user.uid : undefined;
        });
        if (!ownership.committed) {
            const error = new Error('Your saved referral code could not be verified. Please contact CHICHI support.');
            error.statusCode = 409;
            throw error;
        }
    }

    const walletUpdate = await walletRef.transaction(function(wallet) {
        wallet = wallet || {};
        if (!wallet.code) wallet.code = code;
        wallet.enrollmentDecision = 'accepted';
        if (!wallet.enrolledAt) wallet.enrolledAt = Date.now();
        wallet.consentAt = wallet.consentAt || Date.now();
        if (typeof wallet.balance !== 'number') wallet.balance = 0;
        if (typeof wallet.referralCount !== 'number') wallet.referralCount = 0;
        if (!wallet.referrals || typeof wallet.referrals !== 'object') wallet.referrals = {};
        if (!wallet.withdrawals || typeof wallet.withdrawals !== 'object') wallet.withdrawals = {};
        wallet.name = user.name || user.email || 'CHICHI member';
        wallet.email = user.email || '';
        return wallet;
    });
    if (!walletUpdate.committed) {
        const error = new Error('Referral enrollment could not be saved. Please try again.');
        error.statusCode = 503;
        throw error;
    }
    return { enrolled: true, code: walletUpdate.snapshot.val().code };
}

async function declineReferral(firebaseAdmin, uid) {
    const walletRef = firebaseAdmin.database().ref('referralAccounts/' + uid);
    await walletRef.transaction(function(wallet) {
        wallet = wallet || {};
        if (wallet.enrollmentDecision !== 'accepted' && !wallet.enrolledAt) {
            wallet.enrollmentDecision = 'declined';
            wallet.declinedAt = Date.now();
        }
        return wallet;
    });
    return { declined: true };
}

async function registerReferral(firebaseAdmin, user, referralCode) {
    const userRecord = await firebaseAdmin.auth().getUser(user.uid);
    let referralAwarded = false;
    let referralMessage = '';
    const normalizedCode = String(referralCode || '').trim().toUpperCase();

    if (normalizedCode) {
        const createdAt = Date.parse(userRecord.metadata.creationTime || '');
        if (!createdAt || Date.now() - createdAt > REFERRAL_CLAIM_WINDOW_MS) {
            referralMessage = 'Your referral code can only be applied to a newly created account.';
        } else if (!/^[A-Z0-9]{5,40}$/.test(normalizedCode)) {
            const error = new Error('That referral code is not valid.');
            error.statusCode = 400;
            throw error;
        } else {
            const codeOwner = await firebaseAdmin.database().ref('referralCodeOwners/' + normalizedCode).once('value');
            const inviterUid = codeOwner.val();
            if (!inviterUid || inviterUid === user.uid) {
                const error = new Error(inviterUid === user.uid ? 'You cannot use your own referral code.' : 'That referral code was not found.');
                error.statusCode = 400;
                throw error;
            }

            const attributionRef = firebaseAdmin.database().ref('referralAttributions/' + user.uid);
            const attribution = await attributionRef.transaction(function(current) {
                return current || { inviterUid: inviterUid, code: normalizedCode, createdAt: Date.now() };
            });
            const attributedUid = attribution.snapshot.val() && attribution.snapshot.val().inviterUid;
            if (attributedUid === inviterUid) {
                const inviterRef = firebaseAdmin.database().ref('referralAccounts/' + inviterUid);
                let referralWasCredited = false;
                const inviterUpdate = await inviterRef.transaction(function(wallet) {
                    wallet = wallet || {};
                    wallet.referrals = wallet.referrals || {};
                    if (wallet.referrals[user.uid]) {
                        referralWasCredited = false;
                        return wallet;
                    }
                    wallet.referrals[user.uid] = {
                        name: user.name || userRecord.displayName || user.email || 'New member',
                        creditedAt: Date.now(),
                        amount: REWARD_PER_REFERRAL
                    };
                    wallet.referralCount = Number(wallet.referralCount || 0) + 1;
                    wallet.balance = Number(wallet.balance || 0) + REWARD_PER_REFERRAL;
                    referralWasCredited = true;
                    return wallet;
                });
                referralAwarded = Boolean(inviterUpdate.committed && referralWasCredited);
            }
        }
    }

    return {
        referralAwarded: referralAwarded,
        referralMessage: referralMessage
    };
}

function normalizeKenyanPhone(value) {
    let phone = String(value || '').replace(/[\s()-]/g, '');
    if (/^0[17]\d{8}$/.test(phone)) phone = '+254' + phone.slice(1);
    if (/^254[17]\d{8}$/.test(phone)) phone = '+' + phone;
    return /^\+254[17]\d{8}$/.test(phone) ? phone : '';
}

async function createWithdrawal(firebaseAdmin, user, body) {
    const amount = Number(body.amount);
    const method = String(body.method || '');
    const phone = normalizeKenyanPhone(body.phone);
    const provider = String(body.provider || '');
    if (!Number.isSafeInteger(amount) || amount < MINIMUM_WITHDRAWAL) {
        const error = new Error('The minimum withdrawal is KSh 50.');
        error.statusCode = 400;
        throw error;
    }
    if (method !== 'mpesa' && method !== 'airtime') {
        const error = new Error('Choose M-Pesa or airtime.');
        error.statusCode = 400;
        throw error;
    }
    if (!phone) {
        const error = new Error('Enter a valid Kenyan mobile number.');
        error.statusCode = 400;
        throw error;
    }
    if (method === 'airtime' && ['Safaricom', 'Airtel', 'Telkom'].indexOf(provider) === -1) {
        const error = new Error('Choose a supported airtime network.');
        error.statusCode = 400;
        throw error;
    }

    const account = await getReferralWallet(firebaseAdmin, user.uid);
    if (!enrollmentStatus(account.wallet).enrolled) {
        const error = new Error('Join the referral program before requesting a withdrawal.');
        error.statusCode = 403;
        throw error;
    }
    const requestRef = account.ref.child('withdrawals').push();
    const requestId = requestRef.key;
    const createdAt = Date.now();
    const requestData = {
        id: requestId,
        userId: user.uid,
        userName: user.name || user.email || 'CHICHI member',
        userEmail: user.email || '',
        amount: amount,
        method: method,
        provider: method === 'airtime' ? provider : '',
        phone: phone,
        status: 'pending',
        createdAt: createdAt
    };
    const transaction = await account.ref.transaction(function(wallet) {
        wallet = wallet || {};
        wallet.withdrawals = wallet.withdrawals || {};
        if (wallet.withdrawals[requestId]) return wallet;
        const balance = Number(wallet.balance || 0);
        if (balance < amount) return;
        wallet.balance = balance - amount;
        wallet.withdrawals[requestId] = requestData;
        return wallet;
    });
    if (!transaction.committed || !transaction.snapshot.child('withdrawals').child(requestId).exists()) {
        const error = new Error('Your available referral balance is too low for this request.');
        error.statusCode = 400;
        throw error;
    }
    return {
        balance: Number(transaction.snapshot.child('balance').val() || 0),
        request: requestData
    };
}

async function listWithdrawals(firebaseAdmin) {
    const snapshot = await firebaseAdmin.database().ref('referralAccounts').once('value');
    const accounts = snapshot.val() || {};
    const requests = [];
    Object.keys(accounts).forEach(function(uid) {
        const wallet = accounts[uid] || {};
        Object.keys(wallet.withdrawals || {}).forEach(function(id) {
            const request = wallet.withdrawals[id];
            if (request && request.status === 'pending') {
                requests.push(Object.assign({}, request, { id: id, userId: uid }));
            }
        });
    });
    requests.sort(function(a, b) { return Number(b.createdAt || 0) - Number(a.createdAt || 0); });
    return {
        requests: requests,
        pendingAmount: requests.reduce(function(total, request) { return total + Number(request.amount || 0); }, 0)
    };
}

async function updateWithdrawal(firebaseAdmin, user, body) {
    const uid = String(body.userId || '');
    const requestId = String(body.requestId || '');
    const action = String(body.status || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[A-Za-z0-9_-]{1,128}$/.test(requestId)) {
        const error = new Error('Invalid withdrawal request.');
        error.statusCode = 400;
        throw error;
    }
    if (action !== 'paid' && action !== 'rejected') {
        const error = new Error('Choose whether to mark the request paid or reject it.');
        error.statusCode = 400;
        throw error;
    }
    const reference = String(body.paymentReference || '').trim().slice(0, 80);
    const reason = String(body.reason || '').trim().slice(0, 200);
    const requestRef = firebaseAdmin.database().ref('referralAccounts/' + uid);
    let requestWasPending = false;
    const transaction = await requestRef.transaction(function(wallet) {
        if (!wallet || !wallet.withdrawals || !wallet.withdrawals[requestId]) return;
        const request = wallet.withdrawals[requestId];
        if (request.status !== 'pending') {
            requestWasPending = false;
            return wallet;
        }
        request.status = action;
        request.reviewedAt = Date.now();
        request.reviewedBy = user.email || user.uid;
        if (action === 'paid') {
            if (reference) request.paymentReference = reference;
        } else {
            request.rejectionReason = reason || 'Request rejected by administrator';
            wallet.balance = Number(wallet.balance || 0) + Number(request.amount || 0);
        }
        requestWasPending = true;
        return wallet;
    });
    const updatedRequest = transaction.snapshot.child('withdrawals').child(requestId).val();
    if (!transaction.committed || !requestWasPending || !updatedRequest || updatedRequest.status !== action) {
        const error = new Error('This request is no longer pending or could not be updated.');
        error.statusCode = 409;
        throw error;
    }
    return { request: updatedRequest, balance: Number(transaction.snapshot.child('balance').val() || 0) };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    try {
        const firebaseAdmin = getFirebaseAdmin();
        const user = await authenticate(firebaseAdmin, req);
        const body = req.body || {};
        const userSnapshot = await firebaseAdmin.database().ref('users/' + user.uid).once('value');
        const profile = userSnapshot.val() || {};
        const identity = {
            uid: user.uid,
            email: user.email || profile.email || '',
            name: profile.name || user.name || '',
            username: profile.username || ''
        };

        if (body.action === 'register') {
            const result = await registerReferral(firebaseAdmin, identity, body.referralCode);
            return res.status(200).json(result);
        }
        if (body.action === 'enrollmentStatus') {
            const account = await getReferralWallet(firebaseAdmin, user.uid);
            return res.status(200).json(enrollmentStatus(account.wallet));
        }
        if (body.action === 'enroll') {
            return res.status(200).json(await enrollReferral(firebaseAdmin, identity));
        }
        if (body.action === 'declineEnrollment') {
            return res.status(200).json(await declineReferral(firebaseAdmin, user.uid));
        }
        if (body.action === 'summary') {
            const account = await getReferralWallet(firebaseAdmin, user.uid);
            const wallet = account.wallet;
            const status = enrollmentStatus(wallet);
            if (!status.enrolled) {
                return res.status(200).json(Object.assign(status, {
                    balance: Number(wallet.balance || 0),
                    referralCount: Number(wallet.referralCount || 0),
                    referrals: [],
                    withdrawals: []
                }));
            }
            const referrals = Object.keys(wallet.referrals || {}).map(function(id) {
                return Object.assign({ id: id }, wallet.referrals[id]);
            }).sort(function(a, b) { return Number(b.creditedAt || 0) - Number(a.creditedAt || 0); }).slice(0, 20);
            const withdrawals = Object.keys(wallet.withdrawals || {}).map(function(id) {
                return Object.assign({ id: id }, wallet.withdrawals[id]);
            }).sort(function(a, b) { return Number(b.createdAt || 0) - Number(a.createdAt || 0); }).slice(0, 10);
            return res.status(200).json({
                enrolled: true,
                code: status.code,
                balance: Number(wallet.balance || 0),
                referralCount: Number(wallet.referralCount || 0),
                referrals: referrals,
                withdrawals: withdrawals
            });
        }
        if (body.action === 'requestWithdrawal') {
            const result = await createWithdrawal(firebaseAdmin, identity, body);
            return res.status(200).json(result);
        }
        if (body.action === 'listWithdrawals' || body.action === 'updateWithdrawal') {
            await requireAdmin(firebaseAdmin, user);
            if (body.action === 'listWithdrawals') {
                return res.status(200).json(await listWithdrawals(firebaseAdmin));
            }
            return res.status(200).json(await updateWithdrawal(firebaseAdmin, identity, body));
        }

        return res.status(400).json({ error: 'Unknown referral request.' });
    } catch (error) {
        if (!error.statusCode) console.error('Referral API error:', error);
        const configurationError = /FIREBASE_SERVICE_ACCOUNT_JSON/.test(error.message || '');
        return res.status(error.statusCode || 500).json({
            error: error.statusCode ? error.message : (configurationError
                ? 'Referral service setup is incomplete. Please contact CHICHI support.'
                : 'Referral service is temporarily unavailable. Please try again shortly.')
        });
    }
}
