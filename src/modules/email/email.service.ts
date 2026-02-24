import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface SendQuotationEmailOptions {
  to: string;
  cc?: string;
  subject?: string;
  body?: string;
  pdfBuffer: Buffer;
  quotationNumber: string;
  companyName?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private isConfigured(): boolean {
    const host = this.configService.get<string>('smtp.host');
    const user = this.configService.get<string>('smtp.user');
    const pass = this.configService.get<string>('smtp.pass');
    return !!(host && user && pass);
  }

  private createTransporter(): Transporter {
    return nodemailer.createTransport({
      host: this.configService.get<string>('smtp.host'),
      port: this.configService.get<number>('smtp.port') || 587,
      secure: (this.configService.get<number>('smtp.port') || 587) === 465,
      auth: {
        user: this.configService.get<string>('smtp.user'),
        pass: this.configService.get<string>('smtp.pass'),
      },
    });
  }

  async sendQuotationEmail(options: SendQuotationEmailOptions): Promise<void> {
    if (!this.isConfigured()) {
      throw new BadRequestException(
        'Email service not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.',
      );
    }

    const { to, cc, pdfBuffer, quotationNumber, companyName } = options;
    const fromName = companyName || 'Quotation Management';
    const fromAddress = this.configService.get<string>('smtp.from') || 'noreply@quotepro.io';

    const subject = options.subject || `Quotation ${quotationNumber} from ${fromName}`;
    const body =
      options.body ||
      `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
        <p>Dear valued customer,</p>
        <p>Please find attached the quotation <strong>${quotationNumber}</strong> from <strong>${fromName}</strong>.</p>
        <p>Kindly review the attached document for details.</p>
        <p>Should you have any questions, please do not hesitate to contact us.</p>
        <br/>
        <p>Best regards,<br/><strong>${fromName}</strong></p>
      </div>`;

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html: body,
      attachments: [
        {
          filename: `${quotationNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    if (cc) {
      mailOptions.cc = cc;
    }

    const transporter = this.createTransporter();

    try {
      const info = await transporter.sendMail(mailOptions);
      this.logger.log(`Email sent for quotation ${quotationNumber} to ${to} — messageId: ${info.messageId}`);
    } catch (err) {
      this.logger.error(`Failed to send email for quotation ${quotationNumber}: ${err.message}`, err.stack);
      throw err;
    }
  }
}
