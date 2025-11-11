#!/usr/bin/env node

/**
 * 🧪 TEST-EPAYCO.JS
 * Script para verificar la configuración de ePayco
 * 
 * Uso: node test-epayco.js
 */

require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n${colors.cyan}${msg}${colors.reset}\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`),
};

log.header('🧪 VERIFICADOR DE CONFIGURACIÓN ePayco');

// ============================================================================
// 1. VERIFICAR VARIABLES DE ENTORNO
// ============================================================================
log.header('1️⃣  VERIFICANDO VARIABLES DE ENTORNO');

const envVars = {
  'EPAYCO_P_PUBLIC_KEY': process.env.EPAYCO_P_PUBLIC_KEY,
  'EPAYCO_P_KEY': process.env.EPAYCO_P_KEY,
  'EPAYCO_P_TESTING': process.env.EPAYCO_P_TESTING,
  'EPAYCO_PUBLIC_KEY': process.env.EPAYCO_PUBLIC_KEY,
  'FRONTEND_URL': process.env.FRONTEND_URL,
  'BACKEND_URL': process.env.BACKEND_URL,
};

let allVarsOk = true;

for (const [key, value] of Object.entries(envVars)) {
  if (value) {
    if (key.includes('KEY')) {
      const masked = value.substring(0, 10) + '...' + value.substring(value.length - 5);
      log.success(`${key}: ${masked}`);
    } else {
      log.success(`${key}: ${value}`);
    }
  } else {
    log.warn(`${key}: No configurada`);
    allVarsOk = false;
  }
}

// ============================================================================
// 2. VERIFICAR VARIABLES CRÍTICAS
// ============================================================================
log.header('2️⃣  VARIABLES CRÍTICAS PARA ePayco');

const critical = [
  { name: 'EPAYCO_P_PUBLIC_KEY', value: process.env.EPAYCO_P_PUBLIC_KEY, required: true },
  { name: 'EPAYCO_P_KEY', value: process.env.EPAYCO_P_KEY, required: false }, // Opcional para frontend
  { name: 'EPAYCO_P_TESTING', value: process.env.EPAYCO_P_TESTING, required: true },
];

let criticalOk = true;

for (const { name, value, required } of critical) {
  if (value && value.trim() !== '') {
    log.success(`${name}: ✅ Configurada`);
  } else if (required) {
    log.error(`${name}: ❌ FALTANTE O VACÍA (REQUERIDA)`);
    criticalOk = false;
  } else {
    log.warn(`${name}: Opcional, no configurada`);
  }
}

// ============================================================================
// 3. VALIDAR FORMATO DE CLAVES
// ============================================================================
log.header('3️⃣  VALIDANDO FORMATO DE CLAVES');

const publicKey = process.env.EPAYCO_P_PUBLIC_KEY;
if (publicKey) {
  const isTest = publicKey.startsWith('30000');
  const isProd = publicKey.startsWith('90000');
  
  log.info(`Formato: ${publicKey.substring(0, 5)}... (${publicKey.length} caracteres)`);
  
  if (isTest) {
    log.success('Clave de PRUEBA detectada (comienza con 30000)');
  } else if (isProd) {
    log.warn('Clave de PRODUCCIÓN detectada (comienza con 90000)');
  } else {
    log.warn('Formato de clave desconocido (debería comenzar con 30000 o 90000)');
  }
}

// ============================================================================
// 4. VERIFICAR MODO DE TESTING
// ============================================================================
log.header('4️⃣  MODO DE TESTING');

const testMode = process.env.EPAYCO_P_TESTING === 'true';
if (testMode) {
  log.success('Modo TEST ACTIVADO');
  log.info('Los pagos se procesarán en ambiente de prueba');
} else {
  log.warn('Modo TEST DESACTIVADO');
  log.warn('Los pagos se procesarán en PRODUCCIÓN');
}

// ============================================================================
// 5. SIMULAR LO QUE RECIBE EL FRONTEND
// ============================================================================
log.header('5️⃣  DATOS QUE RECIBIRÁ EL FRONTEND');

if (publicKey) {
  const epaycoData = {
    publicKey: publicKey,
    test: testMode ? 'true' : 'false',
    name: 'Pago de prueba',
    description: 'Pago por certificado de partida',
    invoice: 'INV-TEST-123456',
    currency: 'cop',
    amount: '5000',
  };
  
  log.success('✅ epaycoData que se enviará al frontend:');
  console.log(JSON.stringify(epaycoData, null, 2));
} else {
  log.error('❌ No se puede simular epaycoData sin publicKey');
}

// ============================================================================
// 6. DIAGNÓSTICO FINAL
// ============================================================================
log.header('6️⃣  DIAGNÓSTICO FINAL');

if (publicKey && publicKey.trim() !== '') {
  log.success('\n✅ CONFIGURACIÓN CORRECTA');
  log.info('ePayco debería funcionar correctamente');
  log.info('\nPróximos pasos:');
  log.info('1. Reinicia tu servidor Node.js');
  log.info('2. Intenta crear un pago desde el frontend');
  log.info('3. Verifica que el modal de ePayco se abre');
} else {
  log.error('\n❌ CONFIGURACIÓN INCOMPLETA');
  log.error('\nPara arreglar:');
  log.error('1. Abre tu archivo .env');
  log.error('2. Agrega tu EPAYCO_P_PUBLIC_KEY (de dashboard.epayco.co)');
  log.error('3. Agrega tu EPAYCO_P_KEY (de dashboard.epayco.co)');
  log.error('4. Asegúrate que EPAYCO_P_TESTING=true para pruebas');
  log.error('5. Reinicia tu servidor');
  log.error('\nEjemplo de .env:');
  console.log(`
EPAYCO_P_PUBLIC_KEY=30000001234567890123456789
EPAYCO_P_KEY=tu-clave-privada-aqui
EPAYCO_P_TESTING=true
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
  `);
}

// ============================================================================
// 7. RECURSOS ÚTILES
// ============================================================================
log.header('7️⃣  RECURSOS ÚTILES');

console.log(`
📚 Dashboard de ePayco:
   https://dashboard.epayco.co/

📖 Documentación:
   https://developer.epayco.co/

🆘 Soporte ePayco:
   https://epayco.co/contact/

🔧 Verificador de configuración:
   Ejecuta este script nuevamente después de actualizar .env
`);

// ============================================================================
// RESUMEN
// ============================================================================
log.header('📋 RESUMEN');

if (publicKey && testMode) {
  console.log(`
✅ Todo está configurado correctamente
   • Public Key: ${publicKey.substring(0, 10)}...
   • Modo: TEST
   • Estado: LISTO PARA USAR
  `);
  process.exit(0);
} else {
  console.log(`
❌ Hay problemas en la configuración
   • Public Key: ${publicKey ? '✅' : '❌'}
   • Modo Test: ${testMode ? '✅' : '❌'}
   • Estado: REQUIERE AJUSTES
  `);
  process.exit(1);
}
