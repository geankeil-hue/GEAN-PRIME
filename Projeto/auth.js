(function () {
  const STORAGE_KEY = 'freteConectaUsers';
  const SESSION_KEY = 'freteConectaCurrentUser';

  function normalize(value) {
    return String(value ?? '').trim().toLowerCase();
  }

  function readUsers() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  }

  function writeUsers(users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  }

  function readCargas() {
    try {
      const saved = localStorage.getItem('freteConectaCargas');
      const lista = saved ? JSON.parse(saved) : [];
      return Array.isArray(lista) ? lista : [];
    } catch (error) {
      return [];
    }
  }

  function writeCargas(cargas) {
    localStorage.setItem('freteConectaCargas', JSON.stringify(cargas));
  }

  function parseUser(user) {
    if (!user) return null;
    const role = user.role || 'caminhoneiro';
    return {
      id: user.id || Date.now().toString(),
      nome: user.nome || '',
      cpf: user.cpf || '',
      cnpj: user.cnpj || '',
      email: user.email || '',
      senha: user.senha || '',
      role: ['caminhoneiro', 'embarcador', 'destinatario'].includes(role) ? role : 'caminhoneiro',
      createdAt: user.createdAt || new Date().toISOString()
    };
  }

  function findUserByCredentials(identificador, senha, role) {
    const users = readUsers();
    const valor = normalize(identificador);
    const senhaDigitada = String(senha || '').trim();
    const targetRole = role || 'embarcador';

    return users.find((user) => {
      const userParsed = parseUser(user);
      const emailMatch = normalize(userParsed.email) === valor;
      const cpfMatch = normalize(userParsed.cpf) === valor;
      const cnpjMatch = normalize(userParsed.cnpj) === valor;
      const senhaMatch = userParsed.senha === senhaDigitada;
      const roleMatch = userParsed.role === targetRole;

      return (emailMatch || cpfMatch || cnpjMatch) && senhaMatch && roleMatch;
    });
  }

  window.FreteConectaAuth = {
    getUsers: readUsers,
    getCargas: readCargas,
    hideLoginOptions() {
      const current = this.currentUser();
      if (!current) {
        return false;
      }

      const selectors = [
        'a[href="login.html"]',
        'a[href="login-embarcadores.html"]',
        'a[href="login-destinatario.html"]',
        'a[href*="cadastro-"]',
        'a[href="cadastro-caminhoneiros.html"]',
        'a[href="cadastro-embarcadores.html"]',
        'a[href="cadastro-destinatario.html"]',
        '.Encontrar-cargas',
        '.Publicar-uma-carga',
        '.btn-login',
        '.btn-entrar',
        'button[onclick*="entrar"]',
        'button[onclick*="criar"]',
        'a[onclick*="entrar"]',
        'a[onclick*="criar"]'
      ];

      document.querySelectorAll(selectors.join(',')).forEach((element) => {
        if (element) {
          element.style.display = 'none';
          element.setAttribute('aria-hidden', 'true');
        }
      });

      return true;
    },
    logout() {
      localStorage.removeItem(SESSION_KEY);
      return true;
    },
    currentUser() {
      try {
        const stored = localStorage.getItem(SESSION_KEY);
        return stored ? JSON.parse(stored) : null;
      } catch (error) {
        return null;
      }
    },
    findUserByIdentifier(identificador) {
      const users = readUsers();
      const valor = normalize(String(identificador ?? ''));

      if (!valor) {
        return null;
      }

      return users.find((user) => {
        const perfil = parseUser(user);
        return normalize(perfil.email) === valor ||
          normalize(perfil.cpf) === valor ||
          normalize(perfil.cnpj) === valor;
      }) || null;
    },
    sendPasswordRecoveryEmail(identificador) {
      const usuario = this.findUserByIdentifier(identificador);

      if (!usuario) {
        return {
          success: false,
          message: 'Não encontramos uma conta com esse e-mail, CPF ou CNPJ.'
        };
      }

      const perfil = parseUser(usuario);
      const email = String(perfil.email || '').trim();

      if (!email) {
        return {
          success: false,
          message: 'Essa conta não possui um e-mail cadastrado para receber a recuperação.'
        };
      }

      const codigo = 'FRC-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + String(Date.now()).slice(-6);
      localStorage.setItem('freteConectaRecoveryCode', JSON.stringify({
        email,
        codigo,
        userId: perfil.id,
        createdAt: new Date().toISOString()
      }));

      const assunto = 'Recuperação de senha - Frete Conecta';
      const corpo = [
        'Olá ' + (perfil.nome || 'usuário') + ',',
        '',
        'Recebemos sua solicitação de recuperação de senha.',
        'Seu código de segurança é: ' + codigo,
        '',
        'Use este código para redefinir sua senha no site.',
        'Se você não solicitou essa recuperação, ignore este e-mail.',
        '',
        'Atenciosamente,',
        'Frete Conecta'
      ].join('\n');

      const gmailUrl = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email) + '&su=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
      const recoveryPage = 'recuperar-senha.html?email=' + encodeURIComponent(email);

      try {
        if (email.toLowerCase().endsWith('@gmail.com')) {
          window.open(gmailUrl, '_blank', 'noopener');
          setTimeout(() => {
            window.location.href = recoveryPage;
          }, 600);
        } else {
          const mailtoUrl = 'mailto:' + email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
          window.location.href = mailtoUrl;
          setTimeout(() => {
            window.location.href = recoveryPage;
          }, 700);
        }
      } catch (error) {
        const fallbackUrl = 'mailto:' + email + '?subject=' + encodeURIComponent(assunto) + '&body=' + encodeURIComponent(corpo);
        window.location.href = fallbackUrl;
        setTimeout(() => {
          window.location.href = recoveryPage;
        }, 700);
      }

      return {
        success: true,
        email,
        codigo,
        recoveryPage,
        message: 'O Gmail de recuperação foi aberto com o código da conta.'
      };
    },
    verifyRecoveryCode(email, codigo) {
      const stored = (() => {
        try {
          const value = localStorage.getItem('freteConectaRecoveryCode');
          return value ? JSON.parse(value) : null;
        } catch (error) {
          return null;
        }
      })();

      if (!stored) {
        return false;
      }

      return normalize(stored.email) === normalize(email) &&
        String(stored.codigo || '').trim().toUpperCase() === String(codigo || '').trim().toUpperCase();
    },
    resetPassword(email, codigo, novaSenha) {
      const usuario = this.findUserByIdentifier(email);

      if (!usuario) {
        return {
          success: false,
          message: 'Conta não encontrada para esse e-mail, CPF ou CNPJ.'
        };
      }

      const perfil = parseUser(usuario);
      const senhaNova = String(novaSenha || '').trim();

      if (!this.verifyRecoveryCode(perfil.email, codigo)) {
        return {
          success: false,
          message: 'Código de recuperação inválido ou expirado.'
        };
      }

      if (!senhaNova || senhaNova.length < 6) {
        return {
          success: false,
          message: 'A nova senha deve ter pelo menos 6 caracteres.'
        };
      }

      const users = readUsers();
      const index = users.findIndex((user) => {
        const item = parseUser(user);
        return item.id === perfil.id || normalize(item.email) === normalize(perfil.email);
      });

      if (index === -1) {
        return {
          success: false,
          message: 'Usuário não encontrado para atualizar a senha.'
        };
      }

      users[index].senha = senhaNova;
      writeUsers(users);
      localStorage.removeItem('freteConectaRecoveryCode');

      return {
        success: true,
        message: 'Senha redefinida com sucesso.',
        role: perfil.role
      };
    },
    getDisplayName(user) {
      const profile = parseUser(user || this.currentUser());
      if (!profile) return 'Visitante';
      return profile.nome || profile.email || profile.cnpj || 'Usuário';
    },
    getRoleHome(role) {
      switch (role) {
        case 'embarcador':
          return 'para-embarcadores.html';
        case 'destinatario':
          return 'para-destinatarios.html';
        case 'caminhoneiro':
        default:
          return 'para-caminhoneiros.html';
      }
    },
    redirectToRole(role, fallbackLogin) {
      const current = this.currentUser();
      const loginPage = fallbackLogin || 'login.html';

      if (current) {
        if (current.role === role) {
          window.location.href = this.getRoleHome(role);
          return true;
        }
        window.location.href = this.getRoleHome(current.role);
        return true;
      }

      window.location.href = loginPage;
      return false;
    },
    bindRoleNavigation(selector, role, fallbackLogin, areaPage) {
      const links = document.querySelectorAll(selector);

      links.forEach((link) => {
        link.addEventListener('click', (event) => {
          const current = this.currentUser();
          const destino = current && current.role === role ? (areaPage || this.getRoleHome(role)) : (fallbackLogin || 'login.html');

          if (current && current.role !== role) {
            event.preventDefault();
            window.location.href = this.getRoleHome(current.role);
            return;
          }

          if (current && current.role === role) {
            event.preventDefault();
            window.location.href = areaPage || this.getRoleHome(role);
            return;
          }

          event.preventDefault();
          window.location.href = destino;
        });
      });
    },
    requireAuth(role, redirectTo) {
      const current = this.currentUser();

      if (!current) {
        window.location.href = redirectTo || (
          role === 'embarcador' ? 'login-embarcadores.html' :
          role === 'destinatario' ? 'login-destinatario.html' :
          'login.html'
        );
        return null;
      }

      if (role && current.role !== role) {
        const fallback = current.role === 'embarcador'
          ? 'para-embarcadores.html'
          : current.role === 'destinatario'
            ? 'para-destinatarios.html'
            : 'para-caminhoneiros.html';
        window.location.href = fallback;
        return null;
      }

      return current;
    },
    setupUserMenu(options = {}) {
      const container = document.querySelector(options.containerSelector || '.user-panel');
      const current = this.currentUser();

      if (!container) {
        return current;
      }

      if (!current) {
        const loginLink = options.loginLink || 'login-embarcadores.html';
        container.innerHTML = '<a href="' + loginLink + '" class="user-login-link">Entrar</a>';
        return current;
      }

      const nome = this.getDisplayName(current);
      const areaPath = current.role === 'embarcador'
        ? 'para-embarcadores.html'
        : current.role === 'destinatario'
          ? 'para-destinatarios.html'
          : 'para-caminhoneiros.html';

      container.innerHTML = `
        <div class="user-badge">
          <span class="user-badge-icon">👋</span>
          <span class="user-badge-name">${nome}</span>
        </div>
        <a href="${areaPath}" class="user-area-link">Área</a>
        <button type="button" class="user-logout-btn">Sair</button>
      `;

      const logoutButton = container.querySelector('.user-logout-btn');
      if (logoutButton) {
        logoutButton.addEventListener('click', () => {
          this.logout();
          window.location.href = options.redirectAfterLogout || 'index.html';
        });
      }

      this.hideLoginOptions();
      return current;
    },
    register(userData) {
      const users = readUsers();
      const role = (userData && userData.role) || 'embarcador';
      const payload = parseUser({ ...userData, role: ['caminhoneiro', 'embarcador', 'destinatario'].includes(role) ? role : 'caminhoneiro' });
      const email = normalize(payload.email);
      const cpf = normalize(payload.cpf);
      const cnpj = normalize(payload.cnpj);

      if (!payload.nome || !payload.email || !payload.senha) {
        throw new Error('Nome, e-mail e senha são obrigatórios.');
      }

      const jaExiste = users.some((user) => {
        const item = parseUser(user);
        return (
          normalize(item.email) === email ||
          normalize(item.cpf) === cpf ||
          normalize(item.cnpj) === cnpj
        );
      });

      if (jaExiste) {
        throw new Error('Este usuário já está cadastrado.');
      }

      const novoUsuario = {
        ...payload,
        id: payload.id || Date.now().toString(),
        role: payload.role,
        createdAt: payload.createdAt || new Date().toISOString()
      };

      users.push(novoUsuario);
      writeUsers(users);
      localStorage.setItem(SESSION_KEY, JSON.stringify({ ...novoUsuario, senha: undefined }));
      return { ...novoUsuario, senha: undefined };
    },
    login(identificador, senha, role) {
      const user = findUserByCredentials(identificador, senha, role || 'embarcador');

      if (!user) {
        return null;
      }

      const sessionUser = { ...parseUser(user), senha: undefined };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      return sessionUser;
    },
    publishCarga(carga) {
      const usuario = this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para publicar uma carga.');
      }
      if (usuario.role !== 'embarcador') {
        throw new Error('Apenas embarcadores podem publicar cargas.');
      }

      const payload = {
        id: carga && carga.id ? String(carga.id) : `carga-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId: usuario.id,
        userEmail: usuario.email,
        origem: String(carga?.origem || '').trim(),
        destino: String(carga?.destino || '').trim(),
        tipo: String(carga?.tipo || '').trim(),
        peso: String(carga?.peso || '').trim(),
        data: String(carga?.data || '').trim(),
        valor: String(carga?.valor || '').trim(),
        observacoes: String(carga?.observacoes || '').trim(),
        status: 'disponivel',
        caminhoneiroId: '',
        caminhoneiroNome: '',
        createdAt: new Date().toISOString()
      };

      if (!payload.origem || !payload.destino || !payload.tipo || !payload.peso || !payload.data || !payload.valor) {
        throw new Error('Preencha todos os campos obrigatórios para publicar a carga.');
      }

      const cargas = readCargas();
      cargas.unshift(payload);
      writeCargas(cargas);
      return payload;
    },
    getCargasDisponiveis() {
      return readCargas()
        .filter((carga) => !carga.status || carga.status === 'disponivel')
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },
    acceptCarga(cargaId) {
      const usuario = this.currentUser();
      if (!usuario) {
        throw new Error('Faça login para aceitar uma carga.');
      }
      if (usuario.role !== 'caminhoneiro') {
        throw new Error('Apenas caminhoneiros podem aceitar uma carga.');
      }

      const cargas = readCargas();
      const index = cargas.findIndex((carga) => String(carga.id) === String(cargaId));

      if (index === -1) {
        throw new Error('Carga não encontrada.');
      }

      const carga = cargas[index];
      if (carga.status === 'aceita' && carga.caminhoneiroId && carga.caminhoneiroId !== usuario.id) {
        throw new Error('Esta carga já foi aceita por outro caminhoneiro.');
      }

      const atualizada = {
        ...carga,
        status: 'aceita',
        caminhoneiroId: usuario.id,
        caminhoneiroNome: usuario.nome || usuario.email,
        transportador: usuario.nome || usuario.email
      };

      cargas[index] = atualizada;
      writeCargas(cargas);
      return atualizada;
    }
  };

  if (document.readyState !== 'loading') {
    window.FreteConectaAuth.hideLoginOptions();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      window.FreteConectaAuth.hideLoginOptions();
    });
  }
})();
