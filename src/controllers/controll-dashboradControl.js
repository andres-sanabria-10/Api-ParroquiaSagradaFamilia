const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');
const MassSchedule = require('../models/massSchedule');
const User = require('../models/user'); // <-- ✨ 1. IMPORTAR EL MODELO 'User'
const { addDays, startOfDay, endOfDay, add } = require('date-fns');

module.exports = {

  // --- Endpoint para las Tarjetas de Estadísticas ---
  getDashboardStats: async (req, res) => {
    try {
      const today = startOfDay(new Date());
      const next7Days = endOfDay(addDays(today, 7));
      const last30Days = startOfDay(add(today, { days: -30 }));

      // 1. Solicitudes de Partidas Pendientes
      const pendingCertificateRequests = await RequestDeparture.countDocuments({ status: 'Pendiente' });
      
      // 2. Solicitudes de Misas Pendientes
      const pendingMassRequests = await RequestMass.countDocuments({ status: 'Pendiente' });
      
      // 3. Partidas Procesadas (últimos 30 días)
      const processedCertificates = await RequestDeparture.countDocuments({
        status: 'Enviada',
        updatedAt: { $gte: last30Days } 
      });
      
      // 4. Misas Programadas (próximos 7 días)
      const scheduledMasses = await RequestMass.countDocuments({
        status: 'Confirmada', 
        date: { $gte: today, $lte: next7Days }
      });

      // --- ✨ 2. NUEVA LÍNEA PARA CONTAR FELIGRESES ---
      const totalUsers = await User.countDocuments(); // Contamos todos los usuarios

      res.status(200).json({
        pendingCertificateRequests,
        pendingMassRequests,
        processedCertificates,
        scheduledMasses,
        totalUsers // <-- ✨ 3. AÑADIMOS EL NUEVO DATO A LA RESPUESTA
      });

    } catch (error) {
      res.status(500).json({ message: "Error al cargar estadísticas", error: error.message });
    }
  },

  // --- Endpoint para la Actividad Reciente ---
  getRecentActivity: async (req, res) => {
    // (Esta función ya estaba perfecta, no se toca)
    try {
      const recentCertificates = await RequestDeparture.find({ status: 'Pendiente' })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('applicant', 'name lastName');
      const recentMasses = await RequestMass.find({ status: 'Pendiente' })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('applicant', 'name lastName');
      const formattedCerts = recentCertificates.map(r => ({
        _id: r._id,
        type: 'partida',
        description: `Solicitud de Partida de ${r.departureType}`,
        applicantName: r.applicant ? `${r.applicant.name} ${r.applicant.lastName}` : 'Usuario eliminado',
        createdAt: r.createdAt
      }));
      const formattedMasses = recentMasses.map(r => ({
        _id: r._id,
        type: 'misa',
        description: `Solicitud de Misa (${r.intention.substring(0, 20)}...)`,
        applicantName: r.applicant ? `${r.applicant.name} ${r.applicant.lastName}` : 'Usuario eliminado',
        createdAt: r.createdAt
      }));
      const combined = [...formattedCerts, ...formattedMasses]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      res.status(200).json(combined);
    } catch (error) {
      res.status(500).json({ message: "Error al cargar actividad reciente", error: error.message });
    }
  }
};