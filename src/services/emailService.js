const SibApiV3Sdk = require('@getbrevo/brevo');
const fs = require('fs');
const path = require('path');
const { generatePDF } = require('../services/pdfGenerator');

let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

let apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY;

exports.sendResetCode = async (mail, resetCode) => {
  let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = "Código de recuperación de contraseña";
  sendSmtpEmail.htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          h1 { color: #2c3e50; text-align: center; }
          .code { font-size: 24px; font-weight: bold; text-align: center; padding: 10px; background-color: #e74c3c; color: white; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #7f8c8d; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Recuperación de Contraseña para Parroquia la Sagrada Familia</h1>
          <p>Estimado usuario,</p>
          <p>Has solicitado un código para recuperar tu contraseña. Por favor, utiliza el siguiente código:</p>
          <div class="code">${resetCode}</div>
          <p>Si no has solicitado este código, por favor ignora este mensaje o contacta con nuestro soporte técnico.</p>
          <p>Gracias,<br>Equipo de Parroquia la Sagrada Familia</p>
          <div class="footer">
            Este es un mensaje automático, por favor no responda a este correo.
          </div>
        </div>
      </body>
    </html>
  `;
  sendSmtpEmail.sender = { name: "Parroquia la Sagrada Familia", email: process.env.FROM_EMAIL };
  sendSmtpEmail.to = [{ email: mail }];
  
  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email enviado correctamente. ID:', data.messageId);
    return data;
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw new Error('Error al enviar el correo de recuperación');
  }
};

exports.sendVerifyCode = async (mail, resetCode) => {
  let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = "Código de verificación de correo";
  sendSmtpEmail.htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; }
          h1 { color: #2c3e50; text-align: center; }
          .code { font-size: 24px; font-weight: bold; text-align: center; padding: 10px; background-color:rgb(7, 83, 4); color: white; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #7f8c8d; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Verificación de Correo</h1>
          <p>Estimado usuario,</p>
          <p>Has solicitado un código para registrar una cuenta en la Parroquia la Sagrada Familia. Por favor, utiliza el siguiente código:</p>
          <div class="code">${resetCode}</div>
          <p>Si no has solicitado este código, por favor ignora este mensaje o contacta con nuestro soporte técnico.</p>
          <p>Gracias,<br>Equipo de Parroquia la Sagrada Familia</p>
          <div class="footer">
            Este es un mensaje automático, por favor no responda a este correo.
          </div>
        </div>
      </body>
    </html>
  `;
  sendSmtpEmail.sender = { name: "Parroquia la Sagrada Familia", email: process.env.FROM_EMAIL };
  sendSmtpEmail.to = [{ email: mail }];
  
  try {
    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Email enviado correctamente. ID:', data.messageId);
    return data;
  } catch (error) {
    console.error('Error al enviar email:', error);
    throw new Error('Error al enviar el correo de verificación');
  }
};

exports.sendDepartureDocument = async (requestData, departureData) => {
  const pdfPath = path.join(__dirname, 'temp', `${requestData.departureType.toLowerCase()}_${departureData._id}.pdf`);
  
  try {
    // Asegúrate de que la carpeta `temp` exista
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Genera el PDF y guarda en la ruta especificada
    await generatePDF(requestData.departureType, departureData, pdfPath);

    let sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.subject = `Partida de ${requestData.departureType}`;
    sendSmtpEmail.htmlContent = `
      <html>
        <body>
          <h1>Partida de ${requestData.departureType}</h1>
          <p>Estimado/a ${requestData.applicant.name},</p>
          <p>Adjunto encontrará su Partida de ${requestData.departureType} solicitada.</p>
          <p>Gracias por utilizar nuestros servicios.</p>
          <p>Atentamente,<br>Parroquia la Sagrada Familia</p>
        </body>
      </html>
    `;
    sendSmtpEmail.sender = { name: "Parroquia la Sagrada Familia", email: process.env.FROM_EMAIL };
    sendSmtpEmail.to = [{ email: requestData.applicant.mail }];

    // Lee el contenido del archivo PDF y convierte a base64
    const pdfContent = fs.readFileSync(pdfPath);
    sendSmtpEmail.attachment = [{
      content: pdfContent.toString('base64'),
      name: `partida_${requestData.departureType.toLowerCase()}.pdf`
    }];

    const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`Email con partida de ${requestData.departureType} enviado correctamente. ID:`, data.messageId);
    
    // Elimina el archivo temporal
    fs.unlinkSync(pdfPath);

    return data;
  } catch (error) {
    console.error(`Error al enviar email con partida de ${requestData.departureType}:`, error);
    throw new Error(`Error al enviar el correo con la partida de ${requestData.departureType}`);
  }
};
