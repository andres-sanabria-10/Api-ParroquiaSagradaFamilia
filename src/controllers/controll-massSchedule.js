const MassSchedule = require('../models/massSchedule');

module.exports = {
    createMass : async (req, res) => {
        try {
            const { date, timeSlots } = req.body;
            const selectedDate = new Date(date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
    
            // Validar que la fecha no sea anterior a hoy
            if (selectedDate < today) {
                return res.status(400).json({ message: 'No se pueden crear misas para fechas pasadas' });
            }
    
            // Buscar si ya existe un registro para esta fecha
            let schedule = await MassSchedule.findOne({ date: selectedDate.toISOString().split('T')[0] });
    
            if (schedule) {
                // Si existe, verificar si hay horarios duplicados
                const existingTimes = new Set(schedule.timeSlots.map(slot => slot.time));
    
                for (const slot of timeSlots) {
                    if (existingTimes.has(slot.time)) {
                        return res.status(400).json({ message: `La hora ${slot.time} ya está reservada para esta fecha.` });
                    
                    }
                }
    
                // Agregar los nuevos horarios no duplicados
                schedule.timeSlots.push(...timeSlots);
            } else {
                // Si no existe, crear un nuevo registro
                schedule = new MassSchedule({
                    date: selectedDate,
                    timeSlots: timeSlots
                });
            }
    
            const savedSchedule = await schedule.save();
            console.log('Horario guardado:', savedSchedule);
            res.status(201).json(savedSchedule);
        } catch (error) {
            console.error('Error al guardar el horario:', error);
            res.status(400).json({ message: error.message });
        }
    },

    getTimeSlots: async (req, res) => {
        const { date } = req.query;
    
        try {
            const schedule = await MassSchedule.findOne({ date: new Date(date).toISOString().split('T')[0] });
    
            if (!schedule) {
                return res.status(404).json({ message: 'No se encontraron horarios para esta fecha' });
            }
    
            // Filtrar solo los horarios con estado "Libre"
            const availableTimeSlots = schedule.timeSlots.filter(slot => slot.status === "Libre");
            res.status(200).json({ timeSlots: availableTimeSlots });
        } catch (error) {
            console.error('Error al obtener los horarios:', error);
            res.status(500).json({ message: 'Error al obtener los horarios', error });
        }
    },

    removeTimeSlots: async (req, res) => {
        const { date, timeSlots } = req.body;
      
        try {
            const schedule = await MassSchedule.findOne({ date: new Date(date).toISOString().split('T')[0] });
      
            if (!schedule) {
                return res.status(404).json({ message: 'Schedule not found' });
            }
      
            // Filtrar los horarios que no se deben eliminar
            const updatedTimeSlots = schedule.timeSlots.filter(slot => !timeSlots.includes(slot.time));
            schedule.timeSlots = updatedTimeSlots;
            await schedule.save();
      
            res.status(200).json({ message: 'Time slots removed', schedule });
        } catch (error) {
            console.error('Error updating time slots:', error);
            res.status(500).json({ message: 'Error updating time slots', error });
        }
    }
};
