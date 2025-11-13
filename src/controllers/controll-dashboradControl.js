const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');
const MassSchedule = require('../models/massSchedule');
const User = require('../models/user');
const Payment = require('../models/payment');
const { addDays, startOfDay, endOfDay, add, startOfMonth, endOfMonth } = require('date-fns');

module.exports = {

  // --- Endpoint para las Tarjetas de Estadísticas ---
  getDashboardStats: async (req, res) => {
    try {
      const today = startOfDay(new Date());
      const next7Days = endOfDay(addDays(today, 7));
      const last30Days = startOfDay(add(today, { days: -30 }));
      
      // Fechas para "Este Mes"
      const startMonth = startOfMonth(new Date());
      const endMonth = endOfMonth(new Date());

      // --- DATOS PARA SECRETARIA ---
      const pendingCertificateRequests = await RequestDeparture.countDocuments({ status: 'Pendiente' });
      const pendingMassRequests = await RequestMass.countDocuments({ status: 'Pendiente' });
      
      // ✨ CORRECCIÓN 1: Usamos 'requestDate' en lugar de 'updatedAt'
      const processedCertificates = await RequestDeparture.countDocuments({
        status: 'Enviada',
        requestDate: { $gte: last30Days } 
      });
      
      const scheduledMasses = await RequestMass.countDocuments({ status: 'Confirmada', date: { $gte: today, $lte: next7Days } });

      // --- DATOS PARA PÁRROCO ---
      
      // 1. Feligreses Activos
      const totalUsers = await User.countDocuments();

      // 2. Misas este Mes
      const massesThisMonth = await RequestMass.countDocuments({
        status: 'Confirmada',
        date: { $gte: startMonth, $lte: endMonth }
      });

      // ✨ CORRECCIÓN 2: Usamos 'requestDate' aquí también
      // 3. Partidas Emitidas (Este Mes)
      const certificatesThisMonth = await RequestDeparture.countDocuments({
        status: 'Enviada',
        requestDate: { $gte: startMonth, $lte: endMonth }
      });

      // 4. Ingresos del Mes
      const paymentsThisMonth = await Payment.find({
        status: 'approved',
        createdAt: { $gte: startMonth, $lte: endMonth }
      });
      
      const incomeThisMonth = paymentsThisMonth.reduce((sum, payment) => sum + payment.amount, 0);


      res.status(200).json({
        // Datos Secretaria
        pendingCertificateRequests,
        pendingMassRequests,
        processedCertificates,
        scheduledMasses,
        // Datos Párroco
        totalUsers,
        massesThisMonth,
        certificatesThisMonth,
        incomeThisMonth
      });

    } catch (error) {
      res.status(500).json({ message: "Error al cargar estadísticas", error: error.message });
    }
  },

  // --- Endpoint para la Actividad Reciente (MEJORADO) ---
  getRecentActivity: async (req, res) => {
    try {
      // 1. Obtener últimas 5 solicitudes de partidas (CUALQUIER ESTADO)
      // Quitamos el filtro { status: 'Pendiente' }
      const recentCertificates = await RequestDeparture.find()
        .sort({ createdAt: -1 }) // Las más nuevas primero
        .limit(5)
        .populate('applicant', 'name lastName');

      // 2. Obtener últimas 5 solicitudes de misas (CUALQUIER ESTADO)
      // Quitamos el filtro { status: 'Pendiente' }
      const recentMasses = await RequestMass.find()
        .sort({ createdAt: -1 }) // Las más nuevas primero
        .limit(5)
        .populate('applicant', 'name lastName');

      // 3. Mapear y combinar los datos
      const formattedCerts = recentCertificates.map(r => ({
        _id: r._id,
        type: 'partida',
        // Agregamos el estado al texto para saber qué pasó
        description: `Solicitud de ${r.departureType} (${r.status})`, 
        applicantName: r.applicant ? `${r.applicant.name} ${r.applicant.lastName}` : 'Usuario eliminado',
        createdAt: r.createdAt
      }));

      const formattedMasses = recentMasses.map(r => ({
        _id: r._id,
        type: 'misa',
        // Agregamos el estado al texto
        description: `Misa: ${r.intention.substring(0, 15)}... (${r.status})`, 
        applicantName: r.applicant ? `${r.applicant.name} ${r.applicant.lastName}` : 'Usuario eliminado',
        createdAt: r.createdAt
      }));

      // 4. Combinar, ordenar por fecha real y tomar solo las 5 últimas de todo el grupo
      const combined = [...formattedCerts, ...formattedMasses]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      res.status(200).json(combined);

    } catch (error) {
      res.status(500).json({ message: "Error al cargar actividad reciente", error: error.message });
    }
  }
};