const RequestMass = require('../models/requestMass');
const MassSchedule = require('../models/massSchedule');
const { verifyToken } = require('../helpers/gerate-token');
const userModel = require('../models/user');
const { encrypt } = require('../helpers/handleBcrypt');

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
    
            // Crear una nueva solicitud de misa
            const newRequestMass = new RequestMass({
                date,
                time,
                intention,
                applicant: userData._id
            });
    
            // Buscar la programación de misas para la fecha especificada
            const schedule = await MassSchedule.findOne({ date });
    
            if (!schedule) {
                return res.status(404).json({ message: 'No se encontró una programación de misas para esta fecha' });
            }
    
            // Encontrar el horario específico y actualizar su estado
            const timeSlotIndex = schedule.timeSlots.findIndex(slot => slot.time === time);
            
            if (timeSlotIndex === -1) {
                return res.status(404).json({ message: 'El horario especificado no está disponible para esta fecha' });
            }
    
            const timeSlot = schedule.timeSlots[timeSlotIndex];
    
            if (timeSlot.status === 'Ocupado') {
                return res.status(400).json({ message: 'El horario ya está ocupado' });
            }
    
            // Actualizar el estado del horario a 'Ocupado'
            schedule.timeSlots[timeSlotIndex].status = 'Ocupado';
            await schedule.save();
    
            // Guardar la nueva solicitud de misa
            const savedRequestMass = await newRequestMass.save();
    
            // Enviar respuesta de éxito
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
            
                  // 1. Validar datos mínimos de la misa
                  if (!date || !time || !intention) {
                      return res.status(400).json({ message: "Faltan datos de la misa (fecha, hora o intención)." });
                  }
        
                  // 2. Buscar al usuario por DNI
                  // ✨ CAMBIO: Usamos 'userModel' en lugar de 'User'
                  let user = await userModel.findOne({ documentNumber: documentNumber });
            
                  // 3. Si el usuario NO existe, lo creamos
                  if (!user) {
                    if (!name || !lastName || !mail || !birthdate || !typeDocument) {
                      return res.status(400).json({ message: "Faltan datos del solicitante (incluyendo tipo de doc.) para crear el nuevo usuario." });
                    }
                    const tempPassword = await encrypt(documentNumber);
                    
                    // ✨ CAMBIO: Usamos 'userModel' en lugar de 'User'
                    const newUser = new userModel({ 
                      name, lastName, mail, birthdate, documentNumber, typeDocument,
                      password: tempPassword, role: 'Usuario'
                    });
                    user = await newUser.save();
                }
            
                  // 4. Crear la solicitud de misa
                  const newMassRequest = new RequestMass({
                    applicant: user._id, // Enlazamos al usuario (encontrado o creado)
                    date,
                    time,
                    intention,
                    status: 'Pendiente' 
                  });
            
                  const savedRequest = await newMassRequest.save();
                  res.status(201).json(savedRequest);
            
                } catch (error) {
                  if (error.code === 11000) { 
                    return res.status(409).json({ message: "Error de duplicado: El DNI o el correo ya están registrados.", details: error.message });
                  }
                  console.error('Error en adminCreateMassRequest:', error); // Añadido log para más detalles
                  res.status(500).json({ message: "Error interno del servidor", details: error.message });
                }
              }


};