const mongoose = require('mongoose')



const URI = process.env.DB_URI


mongoose.set('strictQuery')

mongoose.connect(URI)
  .then(() => console.log('Connect Success...'))
  .catch(err => console.log(err))

module.exports = mongoose