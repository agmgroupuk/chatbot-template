import 'server-only';
import nodemailer from 'nodemailer';
import { company } from './company';
export function emailConfigured() { return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM); }
export async function sendAuthEmail(email: string, url: string, purpose: 'verify' | 'reset') {
  if (!emailConfigured()) throw new Error('Email delivery is not configured. Please contact the site administrator.');
  const transport = nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT || 587),secure:process.env.SMTP_PORT==='465',requireTLS:process.env.SMTP_PORT!=='465',auth:{user:process.env.SMTP_USER!,pass:process.env.SMTP_PASSWORD!},connectionTimeout:10000,socketTimeout:15000});
  const action = purpose === 'verify' ? 'Confirm your email address' : 'Reset your password';
  const result = await transport.sendMail({from:process.env.EMAIL_FROM,to:email,subject:`${action} - One Fin Solution`,text:`${company.name}\n\n${action}:\n${url}\n\nThis link expires in ${purpose === 'verify' ? '24 hours' : '30 minutes'}. If you did not request it, ignore this email.`});
  if (!result.accepted?.length) throw new Error('Email delivery was not accepted. Please try again later.');
}
