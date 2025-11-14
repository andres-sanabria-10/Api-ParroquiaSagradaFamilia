const RequestMass = require('../models/requestMass');
const MassSchedule = require('../models/massSchedule');
const { verifyToken } = require('../helpers/gerate-token');
const userModel = require('../models/user');
const { encrypt } = require('../helpers/handleBcrypt');
const Payment = require('../models/payment'); 
const { generateReference } = require('../controllers/controll-payment')

module.exports = {

    createRequestMass: async (req, res) => {
        try {
            const { date, time, intention } = req.body;
            
            let token;

            // ✅ OPCIÓN 1: Intentar obtener el token desde el header Authorization
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            } 
            // ✅ OPCIÓN 2 (fallback): Si no está en el header, intentar desde cookies
            else if (req.cookies && req.cookies.jwt) {
                token = req.cookies.jwt;
            }
    
            // Validar token
            if (!token) {
                return res.status(401).json({ error: 'No se proporcionó token de autorización' });
            }
    
            // Verificar token y obtener datos del usuario
            const tokenData = await verifyToken(token);
            const userData = await userModel.findById(tokenData._id);
    
            if (!userData) {
                return res.status(404).json({ error: 'Usuario no encontrado' });
            }
    
            // Validar datos requeridos
            if (!date || !time || !intention) {
                return res.status(400).json({ message: 'Faltan datos requeridos' });
            }
    
            // Crear una nueva solicitud de misa (queda Pendiente)
            const newRequestMass = new RequestMass({
                date,
                time,
                intention,
                applicant: userData._id
            });

            const savedRequestMass = await newRequestMass.save();

            // Reservar temporalmente el slot en la programación de misas
            // La reserva tendrá una expiración corta (misma ventana que los pagos pendientes)
            const RESERVATION_EXPIRATION_MINUTES = 30;
            const reservedUntil = new Date(Date.now() + RESERVATION_EXPIRATION_MINUTES * 60 * 1000);

            // Buscar la programación de misas para la fecha especificada
            const schedule = await MassSchedule.findOne({ date });

            if (!schedule) {
                // Si no hay programación, eliminamos la solicitud creada para evitar inconsistencias
                await RequestMass.findByIdAndDelete(savedRequestMass._id);
                return res.status(404).json({ message: 'No se encontró una programación de misas para esta fecha' });
            }

            // Encontrar el horario específico
            const timeSlotIndex = schedule.timeSlots.findIndex(slot => slot.time === time);
            if (timeSlotIndex === -1) {
                await RequestMass.findByIdAndDelete(savedRequestMass._id);
                return res.status(404).json({ message: 'El horario especificado no está disponible para esta fecha' });
            }

            const timeSlot = schedule.timeSlots[timeSlotIndex];
            // Si ya está ocupado o reservado por otro, rechazamos
            if (timeSlot.status === 'Ocupado' || (timeSlot.reservedUntil && timeSlot.reservedUntil > new Date())) {
                // Liberar la solicitud creada
                await RequestMass.findByIdAndDelete(savedRequestMass._id);
                return res.status(400).json({ message: 'El horario ya está ocupado o reservado' });
            }

            // Marcar como reservado temporalmente
            schedule.timeSlots[timeSlotIndex].status = 'Reservado';
            schedule.timeSlots[timeSlotIndex].available = false;
            schedule.timeSlots[timeSlotIndex].reservedBy = savedRequestMass._id;
            schedule.timeSlots[timeSlotIndex].reservedUntil = reservedUntil;

            await schedule.save();

            // Responder con la solicitud creada (estado Pendiente)
            res.status(201).json(savedRequestMass);
        } catch (error) {
            console.error('Error al crear la solicitud de misa:', error);
            res.status(500).json({ message: 'Error al crear la solicitud de misa', error: error.message });
        }
    },

    getPendingRequestMasses: async (req, res) => {
        try {
            const pendingMasses = await RequestMass.find({ status: 'Pendiente' }).populate('applicant');
            res.status(200).json(pendingMasses);
        } catch (error) {
            res.status(500).json({ message: "Error fetching pending request masses", error: error.message });
        }
    },

    getConfirmedRequestMasses: async (req, res) => {
        try {
            const confirmedMasses = await RequestMass.find({ status: 'Confirmada' }).populate('applicant');
            res.status(200).json(confirmedMasses);
        } catch (error) {
            res.status(500).json({ message: "Error fetching confirmed request masses", error: error.message });
        }
    },

    confirmRequest: async (req, res) => {
        try {
            const { id } = req.params;

            const updatedRequest = await RequestMass.findByIdAndUpdate(
                id,
                { status: 'Confirmada' },
                { new: true }
            );

            if (!updatedRequest) {
                return res.status(404).json({ mensaje: "Solicitud no encontrada" });
            }

            res.status(200).json({
                mensaje: "Solicitud confirmada exitosamente",
                solicitud: updatedRequest
            });
        } catch (error) {
            res.status(500).json({ mensaje: "Error al confirmar la solicitud", error: error.message });
        }
    },

    deleteRequest: async (req, res) => {
        try {
            const { id } = req.params;

            const request = await RequestMass.findById(id);

            if (!request) {
                return res.status(404).json({ mensaje: "Solicitud no encontrada" });
            }

            await RequestMass.findByIdAndDelete(id);

            const updatedSchedule = await MassSchedule.findOneAndUpdate(
                { 
                    date: request.date,
                    "timeSlots.time": request.time
                },
                { 
                    $set: {
                        "timeSlots.$.available": true,
                        "timeSlots.$.status": "Libre"
                    }
                },
                { new: true }
            );

            if (!updatedSchedule) {
                return res.status(404).json({ mensaje: "Horario de misa no encontrado" });
            }

            res.status(200).json({
                mensaje: "Solicitud eliminada y horario actualizado exitosamente",
                horarioActualizado: updatedSchedule
            });
        } catch (error) {
            res.status(500).json({ mensaje: "Error al eliminar la solicitud", error: error.message });
        }
    },


    adminCreateMassRequest: async (req, res) => {
                try {
                  const {
                    // Datos del Usuario
                    documentNumber,
                    typeDocument,
                    name,
                    lastName,
                    mail,
                    birthdate,
                    // Datos de la Misa
                    date,
                    time,
                    intention
                  } = req.body;
                  
                  // --- LA LÍNEA QUE CAUSABA EL ERROR HA SIDO ELIMINADA ---
        
                  // 1. Validar datos
                  if (!date || !time || !intention) {
                    return res.status(400).json({ message: "Faltan datos de la misa (fecha, hora o intención)." });
                  }
        
                  // 2. Buscar o crear al usuario (usando 'userModel' como en tu archivo)
                  let user = await userModel.findOne({ documentNumber: documentNumber });
            
                  // 3. Si el usuario NO existe, lo creamos
                  if (!user) {
                    if (!name || !lastName || !mail || !birthdate || !typeDocument) {
                      return res.status(400).json({ message: "Faltan datos del solicitante (incluyendo tipo de doc.) para crear el nuevo usuario." });
                    }
                    const tempPassword = await encrypt(documentNumber);
                    const newUser = new userModel({ // Usando userModel
                      name, lastName, mail, birthdate, documentNumber, typeDocument,
                      password: tempPassword, role: 'feligres' 
                    });
                    user = await newUser.save();
                  }
            
                  // 4. Crear la solicitud de misa
                  const newMassRequest = new RequestMass({
                    applicant: user._id, 
                    date,
                    time,
                    intention,
                    status: 'Confirmada' 
                  });
            
                  const savedRequest = await newMassRequest.save();
        
                  // --- 5. CREAR EL PAGO MANUALMENTE ---
                  const amount = 25000; // Asumo este costo
                  const description = `Pago (en efectivo) por Misa: ${intention.substring(0, 30)}...`;
                  
                  // Asegúrate de importar 'generateReference' y 'Payment' al inicio del archivo
                  const newPayment = new Payment({
                    userId: user._id,
                    serviceType: 'mass',
                    serviceId: savedRequest._id,
                    onModel: 'RequestMass',
                    amount: amount, 
                    referenceCode: generateReference(), 
                    description: description,
                    status: 'approved', 
                    paymentMethod: 'cash_admin', 
                    confirmedAt: new Date(),
                    payerInfo: {
                      name: `${user.name} ${user.lastName}`,
                      email: user.mail,
                      documentNumber: user.documentNumber,
                    },
                                        gatewayData: {
                                            franchise: 'Efectivo (Admin)',
                                            bank: 'Caja Parroquial',
                                            responseMessage: 'Aprobada (Registro Manual)',
                                            authorization: 'ADMIN-MANUAL', // Ya no depende de req.user
                                            transactionDate: new Date(),
                                        },
                  });
                  
                  await newPayment.save();
                  console.log('✅ Misa y Pago Manual creados:', newPayment.referenceCode);
        
                  // 6. Enviar respuesta de éxito
                  res.status(201).json({ 
                    message: "Misa y pago registrados exitosamente",
                    massRequest: savedRequest,
                    payment: newPayment
                  });
        
            } catch (error) {
                  if (error.code === 11000) { 
                    return res.status(409).json({ message: "Error de duplicado: El DNI o el correo ya están registrados.", details: error.message });
                  }
                  console.error('Error en adminCreateMassRequest:', error);
                  res.status(500).json({ message: "Error interno del servidor", details: error.message });
              }
              },

};