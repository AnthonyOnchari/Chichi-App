// ============================================================
// VERCEL SERVERLESS FUNCTION - Email API Proxy
// Save as: api/sendEmail.js in your Vercel project
// ============================================================

// This function:
// 1. Receives email request from frontend
// 2. Validates the request
// 3. Calls BREVO API with your secret API key
// 4. Returns response to frontend

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { 
            to, 
            subject, 
            htmlContent, 
            senderEmail = 'noreply@brevomail.com',
            senderName = 'CHICHI'
        } = req.body;

        // Validation
        if (!to || !subject || !htmlContent) {
            return res.status(400).json({ 
                error: 'Missing required fields: to, subject, htmlContent' 
            });
        }

        // Get API key from environment variable
        const apiKey = process.env.BREVO_API_KEY;
        if (!apiKey) {
            console.error('BREVO_API_KEY not set in environment variables');
            return res.status(500).json({ 
                error: 'Email service not configured' 
            });
        }

        // Prepare email payload for BREVO
        const payload = {
            sender: {
                name: senderName,
                email: senderEmail
            },
            to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
            subject: subject,
            htmlContent: htmlContent,
            replyTo: {
                email: 'info.onchari@gmail.com',
                name: 'CHICHI Support'
            }
        };

        // Call BREVO API
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // Check if request was successful
        if (!response.ok) {
            console.error('BREVO API Error:', data);
            return res.status(response.status).json({ 
                error: data.message || 'Failed to send email' 
            });
        }

        // Success!
        return res.status(200).json({
            success: true,
            messageId: data.messageId,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error('Email server error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
}
