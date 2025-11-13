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

  // --- Endpoint para la Actividad Reciente (Sin cambios) ---
  getRecentActivity: async (req, res) => {
    try {
      const recentCertificates = await RequestDeparture.find({ status: 'Pendiente' }).sort({ createdAt: -1 }).limit(3).populate('applicant', 'name lastName');
      const recentMasses = await RequestMass.find({ status: 'Pendiente' }).sort({ createdAt: -1 }).limit(3).populate('applicant', 'name lastName');

      const formattedCerts = recentCertificates.map(r => ({
        _id: r._id,
        type: 'partida',
        description: `Solicitud de Partida de ${r.departureType}`,
        applicantName: r.applicant ? `${r.applicant.name} ${r.applicant.lastName}` : 'Usuario eliminado',
        createdAt: r.createdAt // Aquí sí usamos createdAt si el modelo lo tiene (por timestamps: true), si no, cámbialo a requestDate
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