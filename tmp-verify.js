const fs = require('fs');
const vm = require('vm');

function buildAuth() {
  const storage = {};
  const context = {
    console,
    window: {},
    localStorage: {
      getItem: (key) => Object.prototype.hasOwnProperty.call(storage, key) ? storage[key] : null,
      setItem: (key, value) => { storage[key] = String(value); },
      removeItem: (key) => { delete storage[key]; }
    }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('auth.js', 'utf8'), context);
  return context.window.FreteConectaAuth;
}

const authEmb = buildAuth();
authEmb.register({ nome: 'Embarcador Teste', email: 'emb@test.com', senha: '123456', role: 'embarcador' });
const emb = authEmb.login('emb@test.com', '123456', 'embarcador');
const carga = authEmb.publishCarga({
  origem: 'São Paulo - SP',
  destino: 'Rio de Janeiro - RJ',
  tipo: 'Carga seca',
  peso: '14 toneladas',
  data: '2026-11-01',
  valor: 'R$ 2.500,00',
  observacoes: 'Carga urgente'
});

const authCam = buildAuth();
authCam.register({ nome: 'Caminhoneiro Teste', email: 'cam@test.com', senha: '123456', role: 'caminhoneiro' });
const cam = authCam.login('cam@test.com', '123456', 'caminhoneiro');
const aceita = authCam.acceptCarga(carga.id);

if (!emb || !cam || !carga || !carga.id) {
  throw new Error('Dados iniciais ausentes no fluxo de carga.');
}
if (aceita.status !== 'aceita' || aceita.caminhoneiroId !== cam.id) {
  throw new Error('Fluxo de aceite da carga falhou.');
}
console.log('OK', aceita.id, aceita.origem, aceita.destino, aceita.caminhoneiroNome);
