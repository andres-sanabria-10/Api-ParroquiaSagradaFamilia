const mongoose = require('mongoose');

const requestMassSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    intention: {
        type: String,
        required: true
    },

    applicant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Users', 
        required: true
    },
    
    status: {
        type: String,
        default: 'Pendiente'
    }
});

const RequestMass = mongoose.model('RequestMass', requestMassSchema);

module.exports = RequestMass;
