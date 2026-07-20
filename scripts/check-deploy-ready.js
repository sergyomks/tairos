#!/usr/bin/env node
/**
 * Script de validación pre-deploy
 * Verifica que todo esté listo para el deploy a Vercel
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando que el proyecto esté listo para Vercel...\n');

let errors = 0;
let warnings = 0;

// 1. Verificar que existan los archivos necesarios
const requiredFiles = [
  'src/app/api/webhooks/supabase/route.ts',
  'src/lib/chat-handler.ts',
  'src/lib/llm-client.ts',
  'vercel.json',
  '.env.production',
  'package.json',
  'next.config.js',
];

console.log('📁 Verificando archivos requeridos...');
requiredFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - FALTA`);
    errors++;
  }
});

// 2. Verificar .env.production
console.log('\n🔐 Verificando .env.production...');
const envPath = path.join(process.cwd(), '.env.production');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  
  if (envContent.includes('OPENROUTER_API_KEY=sk-or-v1-REEMPLAZA')) {
    console.log('  ⚠️  OPENROUTER_API_KEY no está configurada (todavía tiene el placeholder)');
    warnings++;
  } else if (envContent.includes('OPENROUTER_API_KEY=sk-or-v1-')) {
    console.log('  ✅ OPENROUTER_API_KEY configurada');
  } else {
    console.log('  ❌ OPENROUTER_API_KEY falta o es inválida');
    errors++;
  }
  
  if (envContent.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
    console.log('  ✅ NEXT_PUBLIC_SUPABASE_URL configurada');
  } else {
    console.log('  ❌ NEXT_PUBLIC_SUPABASE_URL falta');
    errors++;
  }
  
  if (envContent.includes('SUPABASE_SERVICE_ROLE_KEY=')) {
    console.log('  ✅ SUPABASE_SERVICE_ROLE_KEY configurada');
  } else {
    console.log('  ❌ SUPABASE_SERVICE_ROLE_KEY falta');
    errors++;
  }
} else {
  console.log('  ❌ .env.production no existe');
  errors++;
}

// 3. Verificar que .env.production NO esté en Git
console.log('\n🔒 Verificando .gitignore...');
const gitignorePath = path.join(process.cwd(), '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (gitignoreContent.includes('.env.production')) {
    console.log('  ✅ .env.production está en .gitignore (no se subirá a GitHub)');
  } else {
    console.log('  ⚠️  .env.production NO está en .gitignore (se podría subir por accidente)');
    warnings++;
  }
}

// 4. Verificar que el package.json tenga los scripts necesarios
console.log('\n📦 Verificando package.json...');
const packagePath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  
  if (packageJson.scripts.build) {
    console.log('  ✅ Script "build" existe');
  } else {
    console.log('  ❌ Script "build" falta');
    errors++;
  }
  
  if (packageJson.dependencies['@supabase/supabase-js']) {
    console.log('  ✅ @supabase/supabase-js instalado');
  } else {
    console.log('  ❌ @supabase/supabase-js falta');
    errors++;
  }
  
  if (packageJson.dependencies.next) {
    console.log('  ✅ Next.js instalado');
  } else {
    console.log('  ❌ Next.js falta');
    errors++;
  }
}

// 5. Verificar que node_modules no esté commiteado
console.log('\n🗂️  Verificando node_modules...');
if (fs.existsSync(path.join(process.cwd(), '.git'))) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  if (gitignoreContent.includes('node_modules')) {
    console.log('  ✅ node_modules está en .gitignore');
  } else {
    console.log('  ⚠️  node_modules NO está en .gitignore');
    warnings++;
  }
}

// Resumen
console.log('\n' + '='.repeat(50));
console.log('📊 RESUMEN\n');

if (errors === 0 && warnings === 0) {
  console.log('✅ ¡Todo listo para el deploy!');
  console.log('\n🚀 Próximos pasos:');
  console.log('   1. git add .');
  console.log('   2. git commit -m "Deploy a Vercel"');
  console.log('   3. git push origin main');
  console.log('   4. Ir a https://vercel.com y conectar tu repo');
  console.log('\n📖 Lee DEPLOY-VERCEL.md para más detalles');
  process.exit(0);
} else {
  if (errors > 0) {
    console.log(`❌ ${errors} error(es) encontrado(s)`);
  }
  if (warnings > 0) {
    console.log(`⚠️  ${warnings} advertencia(s) encontrada(s)`);
  }
  
  console.log('\n🔧 Soluciona los errores antes de hacer el deploy.');
  console.log('📖 Revisa DEPLOY-VERCEL.md para más información.');
  
  if (warnings > 0 && errors === 0) {
    console.log('\n⚠️  Hay advertencias pero puedes continuar si lo deseas.');
    process.exit(0);
  }
  
  process.exit(1);
}
