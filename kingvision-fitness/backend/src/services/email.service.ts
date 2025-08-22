import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';

interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
  }>;
}

// Initialize SendGrid if API key is provided
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Create reusable transporter for development
const createDevTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Main email sending function
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const from = options.from || process.env.EMAIL_FROM || 'noreply@kingvisionfitness.com';

    // Use SendGrid in production
    if (process.env.NODE_ENV === 'production' && process.env.SENDGRID_API_KEY) {
      const msg = {
        to: options.to,
        from: from,
        subject: options.subject,
        text: options.text || '',
        html: options.html || options.text || ''
      };

      await sgMail.send(msg);
      console.log('Email sent via SendGrid');
    } else {
      // Use Nodemailer for development
      const transporter = createDevTransporter();

      const mailOptions = {
        from: from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent via SMTP:', info.messageId);
    }
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Email templates
export const emailTemplates = {
  // Welcome email for new users
  welcome: (firstName: string, verificationUrl: string) => ({
    subject: 'Welcome to KingVision Fitness!',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to KingVision Fitness!</h1>
          </div>
          <div class="content">
            <h2>Hi ${firstName}! 👋</h2>
            <p>We're thrilled to have you join the KingVision Fitness community!</p>
            <p>You're about to embark on an incredible fitness journey with access to:</p>
            <ul>
              <li>💪 Weekly workout plans designed for all fitness levels</li>
              <li>🥗 Nutrition guidance and healthy recipes</li>
              <li>📊 Progress tracking tools</li>
              <li>👥 A supportive community of fitness enthusiasts</li>
            </ul>
            <p>To get started, please verify your email address:</p>
            <center>
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </center>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p>Ready to transform your fitness journey? Let's do this!</p>
            <p><strong>- The KingVision Fitness Team</strong></p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} KingVision Fitness. All rights reserved.</p>
            <p>Stay connected with us on social media!</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  // Workout reminder
  workoutReminder: (firstName: string, workoutTitle: string) => ({
    subject: `🏋️ Time for your workout: ${workoutTitle}`,
    html: `
      <h2>Hey ${firstName}!</h2>
      <p>It's time to crush your workout: <strong>${workoutTitle}</strong></p>
      <p>Remember:</p>
      <ul>
        <li>Stay hydrated 💧</li>
        <li>Warm up properly 🔥</li>
        <li>Focus on form over speed 💯</li>
        <li>Listen to your body 👂</li>
      </ul>
      <p>You've got this! 💪</p>
      <p>Track your progress in the app after you're done!</p>
    `
  }),

  // Weekly progress report
  weeklyProgress: (data: {
    firstName: string;
    workoutsCompleted: number;
    totalMinutes: number;
    caloriesBurned: number;
    streak: number;
  }) => ({
    subject: '📊 Your Weekly Fitness Report',
    html: `
      <h2>Great work this week, ${data.firstName}!</h2>
      <h3>Your Weekly Stats:</h3>
      <ul>
        <li>✅ Workouts Completed: ${data.workoutsCompleted}</li>
        <li>⏱️ Total Minutes: ${data.totalMinutes}</li>
        <li>🔥 Calories Burned: ${data.caloriesBurned}</li>
        <li>🎯 Current Streak: ${data.streak} days</li>
      </ul>
      <p>Keep up the amazing work! Consistency is key to reaching your fitness goals.</p>
      <p>Ready for next week? Check out your upcoming workouts in the app!</p>
    `
  }),

  // New client onboarding
  clientOnboarding: (firstName: string, trainerName: string) => ({
    subject: 'Welcome to Your Personalized Training Program!',
    html: `
      <h2>Welcome ${firstName}!</h2>
      <p>I'm excited to be working with you on your fitness journey!</p>
      <p>As your personal trainer, I'll be providing you with:</p>
      <ul>
        <li>Custom workout plans tailored to your goals</li>
        <li>Personalized meal plans and nutrition guidance</li>
        <li>Weekly check-ins to track your progress</li>
        <li>Direct messaging for questions and support</li>
      </ul>
      <p>Your first custom workout plan is ready in the app. Let's schedule our initial consultation to discuss your goals and create a plan that works for you.</p>
      <p>Looking forward to helping you achieve amazing results!</p>
      <p><strong>- ${trainerName}</strong></p>
    `
  }),

  // Group invitation
  groupInvitation: (firstName: string, groupName: string, inviterName: string, inviteLink: string) => ({
    subject: `You're invited to join ${groupName}!`,
    html: `
      <h2>Hi ${firstName}!</h2>
      <p>${inviterName} has invited you to join <strong>${groupName}</strong> on KingVision Fitness!</p>
      <p>Join the group to:</p>
      <ul>
        <li>Share your fitness journey with like-minded people</li>
        <li>Participate in group challenges</li>
        <li>Get motivated by others' progress</li>
        <li>Access group-specific workouts and content</li>
      </ul>
      <center>
        <a href="${inviteLink}" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Join Group</a>
      </center>
      <p>See you in the group!</p>
    `
  }),

  // Subscription expiring
  subscriptionExpiring: (firstName: string, daysLeft: number, renewLink: string) => ({
    subject: 'Your KingVision Fitness Subscription is Expiring Soon',
    html: `
      <h2>Hi ${firstName},</h2>
      <p>Your Active Client subscription will expire in <strong>${daysLeft} days</strong>.</p>
      <p>Don't lose access to:</p>
      <ul>
        <li>Your custom workout plans</li>
        <li>Personalized meal plans</li>
        <li>Direct trainer communication</li>
        <li>Video check-ins and consultations</li>
      </ul>
      <center>
        <a href="${renewLink}" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Renew Subscription</a>
      </center>
      <p>Questions? Reply to this email or message me in the app.</p>
      <p>Keep crushing your goals!</p>
    `
  }),

  // Achievement unlocked
  achievement: (firstName: string, achievementName: string, description: string) => ({
    subject: `🏆 Achievement Unlocked: ${achievementName}!`,
    html: `
      <h2>Congratulations ${firstName}! 🎉</h2>
      <h3>You've unlocked: ${achievementName}</h3>
      <p>${description}</p>
      <p>Your dedication and hard work are paying off! Keep pushing forward and unlocking new achievements.</p>
      <p>Share your achievement with the community and inspire others!</p>
    `
  }),

  // Password reset
  passwordReset: (firstName: string, resetLink: string) => ({
    subject: 'Password Reset Request - KingVision Fitness',
    html: `
      <h2>Hi ${firstName},</h2>
      <p>We received a request to reset your password.</p>
      <p>Click the link below to create a new password:</p>
      <center>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      </center>
      <p>This link will expire in 1 hour for security reasons.</p>
      <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
      <p>For security tips, visit our help center.</p>
    `
  })
};

// Bulk email sender (for announcements)
export const sendBulkEmail = async (
  recipients: string[],
  subject: string,
  content: string,
  options: {
    isHtml?: boolean;
    batchSize?: number;
    delayMs?: number;
  } = {}
) => {
  const { isHtml = true, batchSize = 50, delayMs = 1000 } = options;

  // Split recipients into batches to avoid rate limits
  const batches = [];
  for (let i = 0; i < recipients.length; i += batchSize) {
    batches.push(recipients.slice(i, i + batchSize));
  }

  const results = {
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const batch of batches) {
    try {
      await sendEmail({
        to: batch,
        subject,
        ...(isHtml ? { html: content } : { text: content })
      });
      results.sent += batch.length;
    } catch (error: any) {
      results.failed += batch.length;
      results.errors.push(`Batch failed: ${error.message}`);
    }

    // Delay between batches to respect rate limits
    if (batches.indexOf(batch) < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
};

// Queue email for later sending (useful for non-urgent emails)
interface QueuedEmail extends EmailOptions {
  scheduledFor?: Date;
  priority?: 'low' | 'normal' | 'high';
  retries?: number;
}

const emailQueue: QueuedEmail[] = [];

export const queueEmail = (email: QueuedEmail) => {
  emailQueue.push({
    ...email,
    scheduledFor: email.scheduledFor || new Date(),
    priority: email.priority || 'normal',
    retries: email.retries || 3
  });
};

// Process email queue (call this periodically)
export const processEmailQueue = async () => {
  const now = new Date();
  const readyEmails = emailQueue.filter(
    email => !email.scheduledFor || email.scheduledFor <= now
  );

  // Sort by priority
  readyEmails.sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    return priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal'];
  });

  for (const email of readyEmails) {
    try {
      await sendEmail(email);
      // Remove from queue after successful send
      const index = emailQueue.indexOf(email);
      if (index > -1) {
        emailQueue.splice(index, 1);
      }
    } catch (error) {
      console.error('Failed to send queued email:', error);
      
      // Retry logic
      if (email.retries && email.retries > 0) {
        email.retries--;
        email.scheduledFor = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes
      } else {
        // Remove from queue after max retries
        const index = emailQueue.indexOf(email);
        if (index > -1) {
          emailQueue.splice(index, 1);
        }
      }
    }
  }
};

// Start email queue processor
if (process.env.NODE_ENV === 'production') {
  setInterval(processEmailQueue, 60 * 1000); // Process queue every minute
}

export default {
  sendEmail,
  sendBulkEmail,
  queueEmail,
  processEmailQueue,
  templates: emailTemplates
};