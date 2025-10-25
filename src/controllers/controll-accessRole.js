module.exports = {
    
accessSuperAdmin : async (req, res) => {
    res.json({ message: "Acceso permitido a la ruta SuperAdmin" });
},


accessAdmin : async (req, res) => {
    res.json({ message: "Acceso permitido a la ruta Admin" });
},

accessUser : async (req, res) => {
    res.json({ message: "Acceso permitido a la ruta Usuario" });
  }
}
