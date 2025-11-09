const RequestMass = require('../models/requestMass');
const RequestDeparture = require('../models/requestDeparture');
const MassSchedule = require('../models/massSchedule');
const { addDays, startOfDay, endOfDay, add } = require('date-fns'); // Necesitarás date-fns: npm install date-fns

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
      
      // 3. Partidas Procesadas (ej. en los últimos 30 días)
      const processedCertificates = await RequestDeparture.countDocuments({
        status: 'Enviada',
        updatedAt: { $gte: last30Days } // Asumiendo que 'Enviada' actualiza 'updatedAt'
      });
      
      // 4. Misas Programadas (ej. en los próximos 7 días)
      const scheduledMasses = await MassSchedule.countDocuments({
        date: { $gte: today, $lte: next7Days }
      });

      res.status(200).json({
        pendingCertificateRequests,
        pendingMassRequests,
        processedCertificates,
        scheduledMasses
      });

    } catch (error) {
      res.status(500).json({ message: "Error al cargar estadísticas", error: error.message });
    }
  },

  // --- Endpoint para la Actividad Reciente ---
  getRecentActivity: async (req, res) => {
    try {
      // 1. Obtener últimas 3 solicitudes de partidas
      const recentCertificates = await RequestDeparture.find({ status: 'Pendiente' })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('applicant', 'name lastName');

      // 2. Obtener últimas 3 solicitudes de misas
      const recentMasses = await RequestMass.find({ status: 'Pendiente' })
        .sort({ createdAt: -1 })
        .limit(3)
        .populate('applicant', 'name lastName');

      // 3. Mapear y combinar los datos
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

      // 4. Combinar, ordenar por fecha y tomar los 5 más recientes
      const combined = [...formattedCerts, ...formattedMasses]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      res.status(200).json(combined);

    } catch (error) {
      res.status(500).json({ message: "Error al cargar actividad reciente", error: error.message });
    }
  }
};