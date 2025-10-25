const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const translations = {
  Baptism: 'Bautismo',
  Confirmation: 'Confirmación',
  Marriage: 'Matrimonio',
  Death: 'Defunción'
};

function generatePDF(departureType, departureData, filePath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.font('Helvetica');

    addDecorateBorder(doc);

    const logoPath = path.join(__dirname, '..', 'services', 'parroquia.png');
    doc.image(logoPath, 50, 50, { width: 100 });
    
    doc.moveDown(3);
    
    doc.fontSize(18).font('Helvetica-Bold').text('PARROQUIA DE SANTA MARIA BOYACÁ', 130, 60, { width: 400, align: 'center' });
    
    const departureTypeSpanish = translations[departureType] || departureType;
    doc.fontSize(16).text(`PARTIDA DE ${departureTypeSpanish.toUpperCase()}`, 130, 85, { width: 400, align: 'center' });

    doc.moveDown(5);

    doc.font('Helvetica').fontSize(12).fillColor('#000000');

    switch (departureType) {
      case 'Baptism':
        generateBaptismContent(doc, departureData);
        break;
      case 'Confirmation':
        generateConfirmationContent(doc, departureData);
        break;
      case 'Marriage':
        generateMarriageContent(doc, departureData);
        break;
      case 'Death':
        generateDeathContent(doc, departureData);
        break;
      default:
        reject(new Error('Tipo de partida no reconocido'));
        return;
    }

    // Agregar firma y sello como imágenes
    doc.moveDown(15);

    const selloPath = path.join(__dirname, '..', 'services', 'sello.png');
    const firmaPath = path.join(__dirname, '..', 'services', 'firma.png');

    doc.image(selloPath, 400, doc.y, { width: 100 });
    doc.image(firmaPath, 400, doc.y + 90, { width: 150 })


    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

function generateBaptismContent(doc, data) {
  doc.text(`En el municipio de Santa María (Boyacá), a los ${data.baptismDate.getDate()} días del mes de ${getMonthName(data.baptismDate.getMonth())} del año ${data.baptismDate.getFullYear()}. Yo, el infrascrito Victor Cardenas, Párroco de esta Parroquia,`, {
    lineGap: 5
  });

  doc.moveDown(2);
  doc.font('Helvetica-Bold').text('BAUTICÉ SOLEMNEMENTE A:', { color: '#1c4587' });
  doc.moveDown(2);
  
  doc.font('Helvetica-Bold').text('Nombres y Apellidos: ', { continued: true })
     .font('Helvetica').text(`${data.baptized.name} ${data.baptized.lastName}`);
  
  doc.font('Helvetica-Bold').text('Fecha de Nacimiento: ', { continued: true })
     .font('Helvetica').text(`${data.baptized.birthdate.toLocaleDateString()}`);
  
  doc.font('Helvetica-Bold').text('Lugar de Nacimiento: ', { continued: true })
     .font('Helvetica').text(`${data.placeBirth}`);
  
  doc.font('Helvetica-Bold').text('Hijo/a de: ', { continued: true })
     .font('Helvetica').text(`${data.fatherName} y ${data.motherName}`);
  
  doc.font('Helvetica-Bold').text('Padrinos: ', { continued: true })
     .font('Helvetica').text(`${data.godfather1} y ${data.godfather2 || 'N/A'}`);
}

function generateConfirmationContent(doc, data) {
  doc.text(`En el municipio de Santa María (Boyacá), a los ${data.confirmationDate.getDate()} días del mes de ${getMonthName(data.confirmationDate.getMonth())} del año ${data.confirmationDate.getFullYear()}, el Excelentísimo Párroco Victor Cardenas,`, {
    lineGap: 5
  });
  doc.moveDown(2);
  doc.font('Helvetica-Bold').text('ADMINISTRÓ EL SACRAMENTO DE LA CONFIRMACIÓN A:', { color: '#1c4587' });
  doc.moveDown(2);
  
  doc.font('Helvetica-Bold').text('Nombres y Apellidos: ', { continued: true })
     .font('Helvetica').text(`${data.confirmed.name} ${data.confirmed.lastName}`);
  
  doc.font('Helvetica-Bold').text('Fecha de Nacimiento: ', { continued: true })
     .font('Helvetica').text(`${data.confirmed.birthdate.toLocaleDateString()}`);
  
  doc.font('Helvetica-Bold').text('Hijo/a de: ', { continued: true })
     .font('Helvetica').text(`${data.fatherName} y ${data.motherName}`);
  
  doc.font('Helvetica-Bold').text('Bautizado/a en: ', { continued: true })
     .font('Helvetica').text(`${data.buatizedParish || 'N/A'}`);
  
  doc.font('Helvetica-Bold').text('Padrino/Madrina: ', { continued: true })
     .font('Helvetica').text(`${data.godfather}`);
}

function generateMarriageContent(doc, data) {
  doc.text(`En el municipio de Santa María (Boyacá), a los ${data.marriageDate.getDate()} días del mes de ${getMonthName(data.marriageDate.getMonth())} del año ${data.marriageDate.getFullYear()}. Ante mí, Victor Cardenas, Párroco de esta Parroquia,`, {
    lineGap: 5
  });
  doc.moveDown(2);
  doc.font('Helvetica-Bold').text('CONTRAJERON MATRIMONIO CANÓNICO:', { color: '#1c4587' });
  doc.moveDown(2);
  
  doc.font('Helvetica-Bold').text('El contrayente:');
  doc.font('Helvetica-Bold').text('Nombres y Apellidos: ', { continued: true })
     .font('Helvetica').text(`${data.husband.name} ${data.husband.lastName}`);
  doc.font('Helvetica-Bold').text('Fecha de Nacimiento: ', { continued: true })
     .font('Helvetica').text(`${data.husband.birthdate.toLocaleDateString()}`);
  doc.font('Helvetica-Bold').text('Hijo de: ', { continued: true })
     .font('Helvetica').text(`${data.father_husband || 'N/A'} y ${data.mother_husband || 'N/A'}`);
  
  doc.moveDown();
  
  doc.font('Helvetica-Bold').text('La contrayente:');
  doc.font('Helvetica-Bold').text('Nombres y Apellidos: ', { continued: true })
     .font('Helvetica').text(`${data.wife.name} ${data.wife.lastName}`);
  doc.font('Helvetica-Bold').text('Fecha de Nacimiento: ', { continued: true })
     .font('Helvetica').text(`${data.wife.birthdate.toLocaleDateString()}`);
  doc.font('Helvetica-Bold').text('Hija de: ', { continued: true })
     .font('Helvetica').text(`${data.father_wife || 'N/A'} y ${data.mother_wife || 'N/A'}`);
  
  doc.moveDown();
  
  doc.font('Helvetica-Bold').text('Testigos: ', { continued: true })
     .font('Helvetica').text(`${data.witness1} y ${data.witness2}`);
}

function generateDeathContent(doc, data) {
  doc.text(`En el municipio de Santa María (Boyacá), a los ${data.deathDate.getDate()} días del mes de ${getMonthName(data.deathDate.getMonth())} del año ${data.deathDate.getFullYear()}. Yo, el infrascrito Victor Cardenas, Párroco de esta Parroquia,`, {
    lineGap: 5
  });

  doc.moveDown(2);
  doc.font('Helvetica-Bold').text('CERTIFICA QUE:', { color: '#1c4587' });
  doc.moveDown(2);
  
  doc.font('Helvetica-Bold').text('Nombres y Apellidos: ', { continued: true })
     .font('Helvetica').text(`${data.dead.name} ${data.dead.lastName}`);
  
  doc.font('Helvetica-Bold').text('Fecha de Nacimiento: ', { continued: true })
     .font('Helvetica').text(`${data.dead.birthdate.toLocaleDateString()}`);
  
  doc.font('Helvetica-Bold').text('Hijo/a de: ', { continued: true })
     .font('Helvetica').text(`${data.fatherName} y ${data.motherName}`);
  
  doc.font('Helvetica-Bold').text('Estado Civil: ', { continued: true })
     .font('Helvetica').text(`${data.civilStatus}`);
  
  doc.moveDown();
  
  doc.font('Helvetica-Bold').text('Falleció el día ', { continued: true })
     .font('Helvetica').text(`${data.deathDate.toLocaleDateString()} y recibió cristiana sepultura`);
  
  doc.font('Helvetica-Bold').text('en el cementerio de ', { continued: true })
     .font('Helvetica').text(`${data.cemeteryName} el día ${data.funeralDate.toLocaleDateString()}.`);
}

function getMonthName(monthIndex) {
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return months[monthIndex];
}

function addDecorateBorder(doc) {
  doc.lineWidth(2)
     .rect(30, 30, doc.page.width - 60, doc.page.height - 60)
     .stroke();
}

module.exports = { generatePDF };