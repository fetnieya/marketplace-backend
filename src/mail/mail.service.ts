import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    const smtpHost = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const smtpPort = this.configService.get<number>('SMTP_PORT', 587);

    console.log('Initializing MailService with SMTP configuration:');
    console.log(`  SMTP_HOST: ${smtpHost}`);
    console.log(`  SMTP_PORT: ${smtpPort}`);
    console.log(`  SMTP_USER: ${smtpUser ? '***configured***' : 'NOT SET'}`);
    console.log(`  SMTP_PASSWORD: ${smtpPassword ? '***configured***' : 'NOT SET'}`);

    if (smtpUser && smtpPassword) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });
      console.log('SMTP transporter created successfully');
    } else {
      console.warn(
        'SMTP credentials not configured. Email sending will be disabled.',
      );
    }
  }

  async sendSellerCredentials(
    email: string,
    firstName: string,
    lastName: string,
    loginEmail: string,
    password: string,
  ): Promise<void> {
    const mailOptions = {
      from:
        this.configService.get<string>('SMTP_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        'noreply@marketplace.com',
      to: email,
      subject: 'Vos identifiants de connexion - Marketplace',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.6;
              color: #2d3748;
              background-color: #f7fafc;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #448c74 0%, #37715d 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px;
            }
            .credentials {
              background-color: #f7fafc;
              border-left: 4px solid #448c74;
              padding: 20px;
              margin: 20px 0;
              border-radius: 6px;
            }
            .credential-item {
              margin: 12px 0;
            }
            .label {
              font-weight: 600;
              color: #4a5568;
              font-size: 14px;
              display: block;
              margin-bottom: 5px;
            }
            .value {
              color: #2d3748;
              font-family: 'Courier New', monospace;
              background-color: #ffffff;
              padding: 8px 12px;
              border-radius: 4px;
              display: inline-block;
              font-size: 16px;
              font-weight: 500;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 6px;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              color: #718096;
              font-size: 12px;
              padding: 20px;
              background-color: #f7fafc;
              border-top: 1px solid #e2e8f0;
            }
            p {
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Marketplace</h1>
            </div>
            
            <div class="content">
              <p><strong>Bonjour ${firstName} ${lastName},</strong></p>
              
              <p>Votre compte vendeur a été créé avec succès.</p>
              
              <p>Vos identifiants de connexion :</p>
              
              <div class="credentials">
                <div class="credential-item">
                  <span class="label">Email</span>
                  <div class="value">${loginEmail}</div>
                </div>
                <div class="credential-item">
                  <span class="label">Mot de passe</span>
                  <div class="value">${password}</div>
                </div>
              </div>
              
              <div class="warning">
                <strong>Important :</strong> Veuillez changer votre mot de passe lors de votre première connexion.
              </div>
              
              <p>Cordialement,<br><strong>L'équipe Marketplace</strong></p>
            </div>
            
            <div class="footer">
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      if (!this.transporter) {
        console.warn(`Email non envoyé à ${email}: SMTP non configuré`);
        return;
      }
      await this.transporter.sendMail(mailOptions);
      console.log(`Email envoyé avec succès à ${email}`);
    } catch (error) {
      console.error(`Erreur lors de l'envoi de l'email à ${email}:`, error);
      // Ne pas lever d'exception pour ne pas bloquer la création du vendeur
      // L'utilisateur peut toujours se connecter même si l'email n'est pas envoyé
    }
  }

  async sendResetCode(
    email: string,
    code: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    const mailOptions = {
      from:
        this.configService.get<string>('SMTP_FROM') ||
        this.configService.get<string>('SMTP_USER') ||
        'noreply@marketplace.com',
      to: email,
      subject: 'Code de réinitialisation - Marketplace',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              line-height: 1.6;
              color: #2d3748;
              background-color: #f7fafc;
              margin: 0;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #448c74 0%, #37715d 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .content {
              padding: 30px;
            }
            .code-box {
              background-color: #f7fafc;
              border-left: 4px solid #448c74;
              padding: 20px;
              margin: 20px 0;
              border-radius: 6px;
              text-align: center;
            }
            .code {
              font-size: 32px;
              font-weight: 700;
              color: #448c74;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 6px;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              color: #718096;
              font-size: 12px;
              padding: 20px;
              background-color: #f7fafc;
              border-top: 1px solid #e2e8f0;
            }
            p {
              margin: 15px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Marketplace</h1>
            </div>
            
            <div class="content">
              <p><strong>Bonjour ${firstName} ${lastName},</strong></p>
              
              <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
              
              <p>Utilisez le code suivant pour réinitialiser votre mot de passe :</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <div class="warning">
                <strong>Important :</strong> Ce code est valide pendant 15 minutes. Ne le partagez avec personne.
              </div>
              
              <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
              
              <p>Cordialement,<br><strong>L'équipe Marketplace</strong></p>
            </div>
            
            <div class="footer">
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      if (!this.transporter) {
        console.warn(`Email non envoyé à ${email}: SMTP non configuré`);
        return;
      }
      await this.transporter.sendMail(mailOptions);
      console.log(`Code de réinitialisation envoyé avec succès à ${email}`);
    } catch (error) {
      console.error(
        `Erreur lors de l'envoi du code de réinitialisation à ${email}:`,
        error,
      );
      throw error;
    }
  }
}
