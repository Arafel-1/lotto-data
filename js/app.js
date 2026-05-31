// ── UI Helpers ────────────────────────────────────────────────────────────
const UI = {
    showToast: function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        else if (type === 'error') icon = '❌';
        else if (type === 'warning') icon = '⚠️';

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">${message}</div>
            <button class="toast-close">&times;</button>
        `;

        container.appendChild(toast);

        // Animate in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
        });

        // Setup auto-dismiss and close button
        let dismissTimeout;
        const dismiss = () => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentElement) toast.remove();
            }, 300); // Wait for transition
        };

        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(dismissTimeout);
            dismiss();
        });

        dismissTimeout = setTimeout(dismiss, 3500);
    },
    confirm: function(message, onConfirm, onCancel, title) {
        title = title || 'Confirmar accion';
        // Remove any existing modal
        var existing = document.getElementById('ui-modal-overlay');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'ui-modal-overlay';
        overlay.className = 'modal-overlay';

        overlay.innerHTML = '<div class="modal-box">' +
            '<div class="modal-title">' + title + '</div>' +
            '<div class="modal-message">' + message + '</div>' +
            '<div class="modal-actions">' +
                '<button id="ui-modal-cancel" class="modal-btn modal-btn-cancel">Cancelar</button>' +
                '<button id="ui-modal-confirm" class="modal-btn modal-btn-confirm">Aceptar</button>' +
            '</div>' +
        '</div>';

        document.body.appendChild(overlay);

        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                overlay.classList.add('show');
            });
        });

        function closeModal() {
            overlay.classList.remove('show');
            setTimeout(function() { if (overlay.parentElement) overlay.remove(); }, 300);
        }

        document.getElementById('ui-modal-confirm').addEventListener('click', function() {
            closeModal();
            if (typeof onConfirm === 'function') onConfirm();
        });

        document.getElementById('ui-modal-cancel').addEventListener('click', function() {
            closeModal();
            if (typeof onCancel === 'function') onCancel();
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                closeModal();
                if (typeof onCancel === 'function') onCancel();
            }
        });
    }
};

// ── App Type (set by launcher) ──────────────────────────────────────────
var currentAppType = null; // 'tradicional' | 'extendida'

// Constants
const START_HOUR = 8;
const END_HOUR = 19; // 7 PM
const SERVIDOR_SYNC = "https://Arafel-1.github.io/lotto-data/"; // Tu servidor real en GitHub

// Valid numbers by app type
const TRAD_VALID_NUMBERS = ['00', ...Array.from({ length: 37 }, (_, i) => i.toString())];
const EXT_VALID_NUMBERS  = ['00', ...Array.from({ length: 76 }, (_, i) => i.toString())]; // 00 + 0-75 = 77

function getValidNumbers() {
    return currentAppType === 'extendida' ? EXT_VALID_NUMBERS : TRAD_VALID_NUMBERS;
}

// Backward compat — used in legacy code paths
const VALID_NUMBERS = TRAD_VALID_NUMBERS;

// Safe localStorage helper function
function safeLoadData(key) {
    try {
        const data = localStorage.getItem(key);
        if (!data) return {};
        return JSON.parse(data);
    } catch (error) {
        console.error(`Error loading ${key}:`, error);
        // Backup corrupted data with timestamp
        const corruptedKey = `${key}_corrupted_${Date.now()}`;
        try {
            const corruptedData = localStorage.getItem(key);
            if (corruptedData) {
                localStorage.setItem(corruptedKey, corruptedData);
                console.warn(`Corrupted data backed up to: ${corruptedKey}`);
            }
        } catch (backupError) {
            console.error('Failed to backup corrupted data:', backupError);
        }
        // Remove corrupted data
        localStorage.removeItem(key);
        // FIX #6: Use non-blocking notification instead of UI.showToast(, 'info')
        setTimeout(function() {
            UI.showToast('Se detectaron datos corruptos y fueron respaldados. La aplicación continuará con datos limpios.', 'warning');
        }, 0);
        return {};
    }
}

// ── localStorage key helpers ────────────────────────────────────────────
function _dbKey()   { return 'lottery_data_' + currentMode; }
function _modeKey() {
    return currentAppType === 'extendida' ? 'extendida_current_mode' : 'current_mode';
}

// ── App type config ───────────────────────────────────────────────────────
const APP_CONFIGS = {
    tradicional: {
        modes:       ['lotto', 'granja', 'selva'],
        modeLabels:  { lotto: '&#127922; Lotto', granja: '&#128004; Granja', selva: '&#127796; Selva' },
        defaultMode: 'lotto',
        modeClass:   { lotto: 'mode-lotto', granja: 'mode-granja', selva: 'mode-selva' }
    },
    extendida: {
        modes:       ['monje', 'guacharo'],
        modeLabels:  { monje: '&#129656; El Monje Millonario', guacharo: '&#129413; El Gu&#225;charo' },
        defaultMode: 'monje',
        modeClass:   { monje: 'mode-monje', guacharo: 'mode-guacharo' }
    }
};

// Mode Management — initialized lazily in initApp()
let currentMode = 'lotto';

// Migrate old data to lotto mode if needed (traditional only)
if (localStorage.getItem('lottery_data') && !localStorage.getItem('lottery_data_lotto')) {
    localStorage.setItem('lottery_data_lotto', localStorage.getItem('lottery_data'));
    localStorage.removeItem('lottery_data');
}

// Utilities
const DateUtils = {
    formatDateVerbose: function(dateStr) {
        if (!dateStr) return '';
        const p = dateStr.split('-');
        const y = parseInt(p[0]), m = parseInt(p[1]) - 1, d = parseInt(p[2]);
        const dn = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const mn = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return dn[new Date(y, m, d).getDay()] + ', ' + d + ' de ' + mn[m] + ' ' + y;
    },

    getToday: () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    daysBetween: (dateStr1, dateStr2) => {
        // Parse as local midnight to avoid timezone issues
        const parseLocal = (str) => {
            const [y, m, d] = str.split('-').map(Number);
            return new Date(y, m - 1, d);
        };
        const d1 = parseLocal(dateStr1);
        const d2 = parseLocal(dateStr2);
        const diffTime = Math.abs(d2 - d1);
        return Math.round(diffTime / (1000 * 60 * 60 * 24));
    }
};

const NumberUtils = {
    normalize: (val) => {
        if (!val) return '';
        const str = String(val);
        if (str === '00') return '00';
        return String(parseInt(str, 10));
    },
    areEqual: (a, b) => {
        return NumberUtils.normalize(a) === NumberUtils.normalize(b);
    }
};

// State — db loaded lazily in initApp()
let currentDate = DateUtils.getToday();
let db = {};
let isSwitchingMode = false;
let currentViewMode = 'prediction';
let sortedDatesCache = null;
let cachedPatterns = null;

function getSortedDates() {
    if (!sortedDatesCache) {
        sortedDatesCache = Object.keys(db).sort();
    }
    return sortedDatesCache;
}

// --- Mapa de Animales TRADICIONAL (38 numeros: 00, 0-36) ---
const ANIMAL_MAP = [
    { num: '0',  name: 'Delfín'   },
    { num: '00', name: 'Ballena'   },
    { num: '1',  name: 'Carnero'   },
    { num: '2',  name: 'Toro'      },
    { num: '3',  name: 'Ciempies'  },
    { num: '4',  name: 'Alacrán'  },
    { num: '5',  name: 'León'     },
    { num: '6',  name: 'Rana'      },
    { num: '7',  name: 'Perico'    },
    { num: '8',  name: 'Ratón'    },
    { num: '9',  name: 'Águila'   },
    { num: '10', name: 'Tigre'     },
    { num: '11', name: 'Gato'      },
    { num: '12', name: 'Caballo'   },
    { num: '13', name: 'Mono'      },
    { num: '14', name: 'Paloma'    },
    { num: '15', name: 'Zorro'     },
    { num: '16', name: 'Oso'       },
    { num: '17', name: 'Pavo'      },
    { num: '18', name: 'Burro'     },
    { num: '19', name: 'Chivo'     },
    { num: '20', name: 'Cochino'   },
    { num: '21', name: 'Gallo'     },
    { num: '22', name: 'Camello'   },
    { num: '23', name: 'Cebra'     },
    { num: '24', name: 'Iguana'    },
    { num: '25', name: 'Gallina'   },
    { num: '26', name: 'Vaca'      },
    { num: '27', name: 'Perro'     },
    { num: '28', name: 'Zamuro'    },
    { num: '29', name: 'Elefante'  },
    { num: '30', name: 'Caimán'   },
    { num: '31', name: 'Lapa'      },
    { num: '32', name: 'Ardilla'   },
    { num: '33', name: 'Pescado'   },
    { num: '34', name: 'Venado'    },
    { num: '35', name: 'Jirafa'    },
    { num: '36', name: 'Culebra'   },
];

// --- Mapa de Animales EXTENDIDA (77 numeros: 00, 0-75) ---
const EXT_ANIMAL_MAP = [
    { num: '00', name: 'Ballena'        },
    { num: '0',  name: 'Delf\u00edn'        },
    { num: '1',  name: 'Carnero'        },
    { num: '2',  name: 'Toro'           },
    { num: '3',  name: 'Ciempies'       },
    { num: '4',  name: 'Alacr\u00e1n'       },
    { num: '5',  name: 'Le\u00f3n'          },
    { num: '6',  name: 'Rana'           },
    { num: '7',  name: 'Perico'         },
    { num: '8',  name: 'Rat\u00f3n'         },
    { num: '9',  name: '\u00c1guila'        },
    { num: '10', name: 'Tigre'          },
    { num: '11', name: 'Gato'           },
    { num: '12', name: 'Caballo'        },
    { num: '13', name: 'Mono'           },
    { num: '14', name: 'Paloma'         },
    { num: '15', name: 'Zorro'          },
    { num: '16', name: 'Oso'            },
    { num: '17', name: 'Pavo'           },
    { num: '18', name: 'Burro'          },
    { num: '19', name: 'Chivo'          },
    { num: '20', name: 'Cochino'        },
    { num: '21', name: 'Gallo'          },
    { num: '22', name: 'Camello'        },
    { num: '23', name: 'Cebra'          },
    { num: '24', name: 'Iguana'         },
    { num: '25', name: 'Gallina'        },
    { num: '26', name: 'Vaca'           },
    { num: '27', name: 'Perro'          },
    { num: '28', name: 'Zamuro'         },
    { num: '29', name: 'Elefante'       },
    { num: '30', name: 'Caim\u00e1n'        },
    { num: '31', name: 'Lapa'           },
    { num: '32', name: 'Ardilla'        },
    { num: '33', name: 'Pescado'        },
    { num: '34', name: 'Venado'         },
    { num: '35', name: 'Jirafa'         },
    { num: '36', name: 'Culebra'        },
    // \u2500\u2500 Extensi\u00f3n Ruleta Grande \u2500\u2500
    { num: '37', name: 'Tortuga'        },
    { num: '38', name: 'B\u00fafalo'         },
    { num: '39', name: 'Lechuza'        },
    { num: '40', name: 'Avispa'         },
    { num: '41', name: 'Canguro'        },
    { num: '42', name: 'Tuc\u00e1n'         },
    { num: '43', name: 'Mariposa'       },
    { num: '44', name: 'Chig\u00fcire'      },
    { num: '45', name: 'Garza'          },
    { num: '46', name: 'Puma'           },
    { num: '47', name: 'Pavo Real'      },
    { num: '48', name: 'Puercoespin'    },
    { num: '49', name: 'Pereza'         },
    { num: '50', name: 'Canario'        },
    { num: '51', name: 'Pel\u00edcano'      },
    { num: '52', name: 'Pulpo'          },
    { num: '53', name: 'Caracol'        },
    { num: '54', name: 'Grillo'         },
    { num: '55', name: 'Oso Hormiguero' },
    { num: '56', name: 'Tibur\u00f3n'       },
    { num: '57', name: 'Pato'           },
    { num: '58', name: 'Hormiga'        },
    { num: '59', name: 'Pantera'        },
    { num: '60', name: 'Camaleon'       },
    { num: '61', name: 'Panda'          },
    { num: '62', name: 'Cachicamo'      },
    { num: '63', name: 'Cangrejo'       },
    { num: '64', name: 'Gavil\u00e1n'       },
    { num: '65', name: 'Ara\u00f1a'         },
    { num: '66', name: 'Lobo'           },
    { num: '67', name: 'Avestruz'       },
    { num: '68', name: 'Jaguar'         },
    { num: '69', name: 'Conejo'         },
    { num: '70', name: 'Bisonte'        },
    { num: '71', name: 'Guacamaya'      },
    { num: '72', name: 'Gorila'         },
    { num: '73', name: 'Hipopotamo'     },
    { num: '74', name: 'Turpial'        },
    { num: '75', name: 'Gu\u00e1charo'       },
];

// Helper: nombre del animal segun el tipo de app activo
// Optimization: O(1) hash maps for animal lookups
const ANIMAL_MAP_HASH = {};
ANIMAL_MAP.forEach(a => ANIMAL_MAP_HASH[a.num] = a.name);

const EXT_ANIMAL_MAP_HASH = {};
EXT_ANIMAL_MAP.forEach(a => EXT_ANIMAL_MAP_HASH[a.num] = a.name);

function getAnimalName(num) {
    const normalized = String(num).trim();
    const mapHash = currentAppType === 'extendida' ? EXT_ANIMAL_MAP_HASH : ANIMAL_MAP_HASH;
    return mapHash[normalized] || '';
}


let inactivityTimer;
let inactivityLastTime = Date.now();
const INACTIVITY_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

function resetInactivity() {
    inactivityLastTime = Date.now();
    localStorage.setItem('session_last_activity', inactivityLastTime);
}

function startInactivityMonitor() {
    // Escuchar eventos de actividad
    window.addEventListener('mousemove', resetInactivity);
    window.addEventListener('keypress', resetInactivity);
    window.addEventListener('touchstart', resetInactivity);
    window.addEventListener('click', resetInactivity);

    // Revisar cada 30 segundos si pasaron 10 minutos
    inactivityTimer = setInterval(() => {
        const now = Date.now();
        const last = parseInt(localStorage.getItem('session_last_activity') || inactivityLastTime);
        if (now - last > INACTIVITY_LIMIT_MS) {
            document.getElementById('main-app').style.display = 'none';
            document.getElementById('login-error').style.display = 'block';
            document.getElementById('login-error').innerHTML = '<p style="color: #f87171; margin: 0; font-weight: 600;">Sesión expirada por inactividad.</p>';
            clearSession();
        }
    }, 30000); // Check every 30s
}

function clearSession() {
    localStorage.removeItem('session_hash');
    localStorage.removeItem('session_last_activity');
    localStorage.removeItem('session_exp_date');
    if(inactivityTimer) clearInterval(inactivityTimer);
}

function forceLogout() {
    clearSession();
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('lottery-launcher').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-cedula').value = '';
    document.getElementById('login-error').style.display = 'none';
    
    const subBanner = document.getElementById('sub-warning-banner');
    if (subBanner) subBanner.style.display = 'none';
}
function validateExpiration(expDateStr) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const exp = new Date(expDateStr + "T00:00:00");
    const diffTime = exp - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { valid: false, days: diffDays };
    return { valid: true, days: diffDays };
}

function updateSubUI(days) {
    const badge = document.getElementById('sub-badge');
    const banner = document.getElementById('sub-warning-banner');
    const text = document.getElementById('sub-days-text');
    
    if(badge) {
        badge.style.display = 'inline-flex';
        badge.innerText = `⏳ ${days} días`;
        if (days <= 7) {
            badge.style.color = '#ef4444';
            badge.style.borderColor = 'rgba(239,68,68,0.3)';
            badge.style.background = 'rgba(239,68,68,0.1)';
        } else {
            badge.style.color = '#60a5fa';
            badge.style.borderColor = 'rgba(59,130,246,0.3)';
            badge.style.background = 'rgba(59,130,246,0.1)';
        }
    }
    
    if(banner && text) {
        if (days <= 7) {
            banner.style.display = 'block';
            text.innerText = days;
        } else {
            banner.style.display = 'none';
        }
    }
}

async function tryAutoLogin() {
    const hash = localStorage.getItem('session_hash');
    const lastActivity = parseInt(localStorage.getItem('session_last_activity') || '0');
    const expDate = localStorage.getItem('session_exp_date');
    
    if (hash && expDate && (Date.now() - lastActivity <= INACTIVITY_LIMIT_MS)) {
        const check = validateExpiration(expDate);
        if (check.valid) {
            resetInactivity();
            startInactivityMonitor();
            updateSubUI(check.days);
            document.getElementById('login-screen').style.display = 'none';
            showLauncher();
        } else {
            clearSession();
        }
    } else {
        clearSession();
    }
}

// Auto-login check
document.addEventListener('DOMContentLoaded', tryAutoLogin);

async function validateLogin() {
    const cedulaInput = document.getElementById('login-cedula').value.trim();
    const errorMsg = document.getElementById('login-error');
    const loginBtn = document.getElementById('login-btn');
    
    if (!cedulaInput) return;
    
    loginBtn.disabled = true;
    loginBtn.innerText = 'Verificando...';
    errorMsg.style.display = 'none';
    
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(cedulaInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // URL del archivo de clientes en GitHub (Raw)
        const jsonUrl = 'https://raw.githubusercontent.com/Arafel-1/lotto-data/main/data/clients.json';
        
        const response = await fetch(jsonUrl + '?' + new Date().getTime());
        if (!response.ok) throw new Error("No se pudo cargar la base de datos.");
        
        const validClients = await response.json();
        const expirationDate = validClients[hashHex];
        
        if (expirationDate) {
            const check = validateExpiration(expirationDate);
            if (check.valid) {
                localStorage.setItem('session_hash', hashHex);
                localStorage.setItem('session_exp_date', expirationDate);
                resetInactivity();
                startInactivityMonitor();
                
                updateSubUI(check.days);
                
                document.getElementById('login-screen').style.display = 'none';
                showLauncher();
            } else {
                errorMsg.style.display = 'block';
                errorMsg.innerHTML = '<p style="color: #f87171; margin: 0 0 1rem 0; font-weight: 600;">Tu suscripción ha vencido.</p><a href="https://wa.me/message/YE55X7DRQGYXL1" target="_blank" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 0.6rem 1rem; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">📲 Contactar para Renovar</a>';
            }
        } else {
            errorMsg.style.display = 'block';
            errorMsg.innerHTML = '<p style="color: #f87171; margin: 0 0 1rem 0; font-weight: 600;">Cédula incorrecta o no autorizada.</p><a href="https://wa.me/message/YE55X7DRQGYXL1" target="_blank" style="display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 0.6rem 1rem; border-radius: 6px; font-weight: bold; font-size: 0.9rem;">📲 Solicitar Acceso</a>';
        }
    } catch (e) {
        console.error(e);
        errorMsg.style.display = 'block';
        errorMsg.innerHTML = '<p style="color: #f87171; margin: 0; font-weight: 600;">Error de conexión.</p>';
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerText = 'Entrar al Sistema';
    }
}

// ── Launcher Functions ────────────────────────────────────────────────────
function showLauncher() {
    var launcher = document.getElementById('lottery-launcher');
    var mainApp  = document.getElementById('main-app');
    if (launcher) launcher.style.display = 'flex';
    if (mainApp)  mainApp.style.display  = 'none';
}

function hideLauncher() {
    var launcher = document.getElementById('lottery-launcher');
    var mainApp  = document.getElementById('main-app');
    if (launcher) launcher.style.display = 'none';
    if (mainApp)  mainApp.style.display  = 'block';
}

function selectAppType(type) {
    currentAppType = type;
    var cfg = APP_CONFIGS[type];

    // Set currentMode from saved preference, or default
    currentMode = localStorage.getItem(_modeKey()) || cfg.defaultMode;

    // Load db for this type+mode
    db = safeLoadData(_dbKey());
    sortedDatesCache = null;
    cachedPatterns   = null;

    // Rebuild dynamic sidebar modes
    _buildSidebarModes(cfg);

    // Hide launcher, show app
    hideLauncher();

    // Initialize app if first time, else refresh UI
    if (!window._appInitialized) {
        window._appInitialized = true;
        init();
    } else {
        // Re-init UI for new type
        generateInputGrid();
        populateSelect();
        loadDayData(currentDate);
        renderHistory();
        var cfg2 = APP_CONFIGS[currentAppType];
        _syncModeUI(currentMode, cfg2);
    }
}

function goHome() {
    // Save current state before leaving
    try { localStorage.setItem(_dbKey(), JSON.stringify(db)); } catch(e) {}
    try { localStorage.setItem(_modeKey(), currentMode); } catch(e) {}
    // NOTE: _appInitialized stays true — listeners must NOT be duplicated
    // Clear cached data
    db = {};
    sortedDatesCache = null;
    cachedPatterns   = null;
    // Show launcher
    showLauncher();
}

function _buildSidebarModes(cfg) {
    var optList = document.getElementById('mode-options');
    var selEl   = document.getElementById('mode-select');
    if (!optList || !selEl) return;

    // Rebuild mode-options
    optList.innerHTML = '';
    selEl.innerHTML   = '';
    cfg.modes.forEach(function(m) {
        // Custom dropdown option
        var div = document.createElement('div');
        div.className    = 'mode-option';
        div.dataset.value = m;
        div.innerHTML    = cfg.modeLabels[m] || m;
        optList.appendChild(div);
        // Native select option
        var opt = document.createElement('option');
        opt.value       = m;
        opt.textContent = div.textContent;
        selEl.appendChild(opt);
    });
}

function _syncModeUI(mode, cfg) {
    var modeBtnLbl  = document.getElementById('mode-btn-label');
    var modeOptList = document.getElementById('mode-options');
    var modeIndicator = document.getElementById('mode-indicator');
    var modeSelect    = document.getElementById('mode-select');

    if (modeBtnLbl)  modeBtnLbl.innerHTML = cfg.modeLabels[mode] || mode;
    if (modeSelect)  modeSelect.value     = mode;
    if (modeOptList) {
        modeOptList.querySelectorAll('.mode-option').forEach(function(el) {
            el.classList.toggle('active', el.dataset.value === mode);
        });
    }
    if (modeIndicator) {
        modeIndicator.innerHTML  = cfg.modeLabels[mode] || mode;
        modeIndicator.className  = 'mode-indicator-badge ' + (cfg.modeClass[mode] || '');
    }
}

// DOM Elements
const dateInput = document.getElementById('entry-date');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const targetSelect = document.getElementById('target-number');
const statsGrid = document.getElementById('stats-grid');
const historyBody = document.querySelector('#history-table tbody');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initialization
function init() {
    // Validate critical DOM elements
    const criticalElements = {
        'entry-date': dateInput,
        'grid-container': document.querySelector('.grid-container'),
        'save-btn': saveBtn,
        'clear-btn': clearBtn,
        'target-number': targetSelect,
        'stats-grid': statsGrid,
        'history-table tbody': historyBody
    };

    const missingElements = [];
    for (const [name, element] of Object.entries(criticalElements)) {
        if (!element) {
            missingElements.push(name);
        }
    }

    if (missingElements.length > 0) {
        console.error('Error crítico: Elementos DOM no encontrados:', missingElements);
        UI.showToast('Error al cargar la aplicación. Por favor, recarga la página.', 'error');
        return;
    }

    setupTabs();
    setupDateInput();
    generateInputGrid();
    populateSelect();
    loadDayData(currentDate);
    renderHistory();

    // Event Listeners
    saveBtn.addEventListener('click', saveCurrentDay);
    clearBtn.addEventListener('click', clearCurrentDay);
    dateInput.addEventListener('change', (e) => {
        currentDate = e.target.value;
        cachedPatterns = null;
        loadDayData(currentDate);
    });
    targetSelect.addEventListener('change', (e) => {
        if (e.target.value) {
            runAnalysis(e.target.value);
            // Update animal label below selector
            const label = document.getElementById('analysis-animal-label');
            if (label) {
                const name = getAnimalName(e.target.value);
                label.textContent = name ? `🐾 ${name}` : '';
            }
        }
    });

    // View Mode Toggle Listener
    const viewModeToggle = document.getElementById('view-mode-toggle');
    if (viewModeToggle) {
        // Init state
        viewModeToggle.checked = currentViewMode === 'validation';

        viewModeToggle.addEventListener('change', (e) => {
            currentViewMode = e.target.checked ? 'validation' : 'prediction';
            renderStrongNumbers();
        });
    }

    // History search listener
    const historySearch = document.getElementById('history-search');
    if (historySearch) {
        historySearch.addEventListener('input', (e) => {
            const searchValue = e.target.value.trim();
            renderHistory(searchValue);
        });
    }

    // Strong Number search listener
    const strongSearch = document.getElementById('strong-search-input');
    if (strongSearch) {
        let debounceTimer;
        strongSearch.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                renderStrongNumbers();
            }, 300); // 300ms debounce
        });
    }
      
    // Mode selector: custom dropdown (compatible Windows 7)
    const modeSelect  = document.getElementById('mode-select');
    const modeWrapper = document.getElementById('custom-mode-dropdown');
    const modeBtn     = document.getElementById('mode-btn');
    const modeBtnLbl  = document.getElementById('mode-btn-label');
    const modeOptList = document.getElementById('mode-options');

    var cfg = APP_CONFIGS[currentAppType] || APP_CONFIGS.tradicional;

    // Sync hidden select and label to current mode on load
    if (modeSelect) modeSelect.value = currentMode;
    _syncModeUI(currentMode, cfg);

    // Toggle open/close
    if (modeBtn && modeWrapper) {
        modeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            modeWrapper.classList.toggle('open');
        });
    }

    // Option click — uses _syncModeUI so it works for both app types
    if (modeOptList) {
        modeOptList.addEventListener('click', function(e) {
            var opt = e.target.closest('.mode-option');
            if (!opt) return;
            var val = opt.dataset.value;
            if (val && val !== currentMode) {
                var activeCfg = APP_CONFIGS[currentAppType] || APP_CONFIGS.tradicional;
                _syncModeUI(val, activeCfg);
                if (modeSelect) modeSelect.value = val;
                switchMode(val);
            }
            if (modeWrapper) modeWrapper.classList.remove('open');
        });
    }

    // Close when clicking outside
    document.addEventListener('click', function() {
        if (modeWrapper) modeWrapper.classList.remove('open');
    });

    // Help menu listeners
    setupHelpMenu();
}

// Tabs Logic
function setupTabs() {
    const mobileNav = document.getElementById('mobile-nav');

    // Helper to switch tab
    const switchTab = (tabId) => {
        // Update buttons
        tabBtns.forEach(b => {
            if (b.dataset.tab === tabId) b.classList.add('active');
            else b.classList.remove('active');
        });

        // Update content
        tabContents.forEach(c => c.classList.remove('active'));
        document.getElementById(`${tabId}-section`).classList.add('active');

        // Update mobile dropdown if it exists and values differ
        if (mobileNav && mobileNav.value !== tabId) {
            mobileNav.value = tabId;
        }

        // Update active tab pill in header
        var TAB_LABELS = {
            'input':         '&#128221; Registro Diario',
            'strong-number': '&#128170; N&#250;mero Fuerte',
            'analysis':      '&#128202; An&#225;lisis de Asociados',
            'jaula':         '&#127922; Jaula',
            'patterns':      '&#9733; Patrones',
            'history':       '&#128218; Historial',
            'biblioteca':    '&#9874; Biblioteca',
            'fechas':        '&#128336; Fechas',
            'ganancias':     '&#128200; Ganancias'
        };
        var tabLabelEl = document.getElementById('active-tab-label');
        if (tabLabelEl) tabLabelEl.innerHTML = TAB_LABELS[tabId] || tabId;

        // Close sidebar when a tab is selected
        closeSidebar();

        // Refresh data specific to tab
        if (tabId === 'history') renderHistory();
        if (tabId === 'strong-number') {
            const viewModeToggle = document.getElementById('view-mode-toggle');
            if (viewModeToggle) viewModeToggle.checked = currentViewMode === 'validation';
            renderStrongNumbers();
        }
        if (tabId === 'jaula') renderJaula();
        if (tabId === 'patterns') analyzePatterns();
        if (tabId === 'biblioteca') renderBiblioteca();
        if (tabId === 'fechas') setupFechas();
        if (tabId === 'ganancias') renderGanancias();
        if (tabId === 'analysis') _updateAnalysisHeader();
    };

    // Button Listeners
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    // Mobile Dropdown Listener
    if (mobileNav) {
        mobileNav.addEventListener('change', (e) => {
            switchTab(e.target.value);
        });
    }

    // Hamburger / Sidebar
    setupSidebar();
    // Neto global inicial
    if (typeof updateGlobalNeto === 'function') updateGlobalNeto();
}

// Input Section Logic - Calendario Flotante Personalizado
const MONTH_NAMES = [
    'Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

// Estado interno del calendario
let calViewYear  = null;
let calViewMonth = null;

function setupDateInput() {
    // Sincronizar el input nativo (oculto) con currentDate
    dateInput.value = currentDate;

    // Establecer la vista inicial en el mes de la fecha actual
    const parts = currentDate.split('-');
    calViewYear  = parseInt(parts[0]);
    calViewMonth = parseInt(parts[1]) - 1; // 0-indexed

    // Actualizar el texto del botón
    updateDateButton(currentDate);

    // Renderizar el calendario con la vista actual
    renderCalendar();

    // --- Event Listeners del calendario ---
    const btn      = document.getElementById('date-display-btn');
    const popover  = document.getElementById('cal-popover');
    const prevBtn  = document.getElementById('cal-prev');
    const nextBtn  = document.getElementById('cal-next');
    const todayBtn = document.getElementById('cal-today-btn');

    if (!btn || !popover) return;

    // Abrir/cerrar al hacer clic en el botón
    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = popover.classList.contains('cal-visible');
        if (isOpen) {
            closeCalendar();
        } else {
            openCalendar();
        }
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', function(e) {
        if (!popover.contains(e.target) && e.target !== btn) {
            closeCalendar();
        }
    });

    // Navegación mes anterior/siguiente
    if (prevBtn) prevBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        calViewMonth--;
        if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
        renderCalendar();
    });

    if (nextBtn) nextBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        calViewMonth++;
        if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
        renderCalendar();
    });

    // Botón "Hoy"
    if (todayBtn) todayBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        selectCalendarDate(DateUtils.getToday());
        closeCalendar();
    });
}

function openCalendar() {
    const popover = document.getElementById('cal-popover');
    const btn     = document.getElementById('date-display-btn');
    if (!popover) return;
    // Sync view to currently selected date
    const parts = currentDate.split('-');
    calViewYear  = parseInt(parts[0]);
    calViewMonth = parseInt(parts[1]) - 1;
    renderCalendar();
    popover.classList.add('cal-visible');
    if (btn) btn.classList.add('cal-open');
}

function closeCalendar() {
    const popover = document.getElementById('cal-popover');
    const btn     = document.getElementById('date-display-btn');
    if (popover) popover.classList.remove('cal-visible');
    if (btn)     btn.classList.remove('cal-open');
}

function renderCalendar() {
    const label    = document.getElementById('cal-month-label');
    const daysGrid = document.getElementById('cal-days');
    if (!label || !daysGrid) return;

    label.textContent = MONTH_NAMES[calViewMonth] + ' ' + calViewYear;

    const today = DateUtils.getToday();
    // First day of month (0=Sun..6=Sat)
    const firstDay = new Date(calViewYear, calViewMonth, 1).getDay();
    // Last day of month
    const lastDay  = new Date(calViewYear, calViewMonth + 1, 0).getDate();

    daysGrid.innerHTML = '';

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'cal-day empty';
        daysGrid.appendChild(empty);
    }

    // Day cells
    for (let d = 1; d <= lastDay; d++) {
        const mm   = String(calViewMonth + 1).padStart(2, '0');
        const dd   = String(d).padStart(2, '0');
        const dateStr = calViewYear + '-' + mm + '-' + dd;

        const cell = document.createElement('div');
        cell.className = 'cal-day';
        cell.textContent = d;

        if (dateStr === today)        cell.classList.add('today');
        if (dateStr === currentDate)  cell.classList.add('selected');
        if (db[dateStr]) {
            const totalSlots = END_HOUR - START_HOUR + 1; // 12
            const filled = Object.values(db[dateStr]).filter(v => v && v.trim() !== '').length;
            if (filled >= totalSlots) {
                cell.classList.add('has-data-full');    // verde: completo
            } else {
                cell.classList.add('has-data-partial'); // amarillo: incompleto
            }
        }

        cell.addEventListener('click', (function(ds) {
            return function(e) {
                e.stopPropagation();
                selectCalendarDate(ds);
                closeCalendar();
            };
        })(dateStr));

        daysGrid.appendChild(cell);
    }
}

function selectCalendarDate(dateStr) {
    currentDate = dateStr;
    cachedPatterns = null; // Invalidar cache al cambiar fecha
    dateInput.value = dateStr; // keep native input in sync
    updateDateButton(dateStr);
    loadDayData(dateStr);
    // Auto-update pyramid if Fechas tab is initialized
    autoRunFechas(dateStr);
    // Refresh Número Fuerte if it's the active tab
    var snSection = document.getElementById('strong-number-section');
    if (snSection && snSection.classList.contains('active')) {
        renderStrongNumbers();
    }
    // Actualizar neto global al cambiar fecha
    if (typeof updateGlobalNeto === 'function') updateGlobalNeto();
}

function updateDateButton(dateStr) {
    const textEl = document.getElementById('date-display-text');
    if (textEl) textEl.textContent = DateUtils.formatDateVerbose(dateStr);
}


function generateInputGrid() {
    const container = document.querySelector('.grid-container');
    container.innerHTML = '';

    for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
        const timeLabel = formatTime(hour);
        const div = document.createElement('div');
        div.className = 'time-slot';
        div.innerHTML = `
            <span class="time-label">${timeLabel}</span>
            <input type="text" 
                   class="number-input" 
                   data-hour="${hour}" 
                   placeholder="--" 
                   maxlength="2"
                   inputmode="numeric">
            <span class="slot-animal-name"></span>
        `;
        container.appendChild(div);
    }

    // Input validation listeners
    document.querySelectorAll('.number-input').forEach(input => {
        input.addEventListener('input', (e) => {
            // Allow only numbers
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            // Update animal name label in real time
            const slot = e.target.closest('.time-slot');
            const label = slot ? slot.querySelector('.slot-animal-name') : null;
            if (label) {
                const name = getAnimalName(e.target.value.trim());
                label.textContent = name || '';
            }
        });

        input.addEventListener('blur', (e) => {
            validateInput(e.target);
            // Final update of animal label after validation (value may change)
            const slot = e.target.closest('.time-slot');
            const label = slot ? slot.querySelector('.slot-animal-name') : null;
            if (label) {
                const name = getAnimalName(e.target.value.trim());
                label.textContent = name || '';
            }
        });
    });
}

function formatTime(hour) {
    const h = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return `${h}:00 ${ampm}`;
}

function validateInput(input) {
    const val = input.value.trim();

    // Clear error state first
    input.classList.remove('error');

    // Empty input is valid (user can leave it blank)
    if (!val) {
        return true;
    }

    // Check if it's in the valid numbers list
    if (getValidNumbers().includes(val)) {
        return true;
    }

    // If not in list, perform additional validation
    // Check if it contains only digits
    if (!/^\d+$/.test(val)) {
        UI.showToast(`❌ Número inválido: "${val}". Solo se permiten dígitos (0-9, 'info').`);
        input.value = '';
        input.classList.add('error');
        input.focus();
        return false;
    }

    // Parse as integer and validate range
    const numVal = parseInt(val, 10);

    if (isNaN(numVal)) {
        UI.showToast(`❌ Número inválido: "${val}". Debe ser un número válido.`, 'info');
        input.value = '';
        input.classList.add('error');
        input.focus();
        return false;
    }

    const maxNum = currentAppType === 'extendida' ? 75 : 36;
    if (numVal < 0 || numVal > maxNum) {
        UI.showToast(`❌ Número fuera de rango: ${numVal}. Debe ser entre 0 y ${maxNum} (o 00, 'error').`);
        input.value = '';
        input.classList.add('error');
        input.focus();
        return false;
    }

    // If we get here, it's a valid number but might need formatting
    // For example, "5" is valid, "05" is not in VALID_NUMBERS but is still valid as "5"
    // Note: "00" is special and different from "0"
    if (val !== '00' && val.length > 1 && val[0] === '0') {
        // Remove leading zero (e.g., "05" -> "5")
        const normalized = numVal.toString();
        input.value = normalized;
        return true;
    }

    // Should not reach here, but just in case
    return true;
}

function loadDayData(date) {
    const data = db[date] || {};
    document.querySelectorAll('.number-input').forEach(input => {
        const hour = input.dataset.hour;
        input.value = data[hour] || '';
        // Update animal name label
        const slot = input.closest('.time-slot');
        const label = slot ? slot.querySelector('.slot-animal-name') : null;
        if (label) {
            const name = getAnimalName(input.value.trim());
            label.textContent = name || '';
        }
    });
}

function saveCurrentDay() {
    const inputs = document.querySelectorAll('.number-input');
    const dayData = {};
    let hasData = false;

    inputs.forEach(input => {
        if (input.value) {
            dayData[input.dataset.hour] = input.value;
            hasData = true;
        }
    });

    if (hasData) {
        db[currentDate] = dayData;
        localStorage.setItem(_dbKey(), JSON.stringify(db));
        sortedDatesCache = null; // Invalidate cache
        cachedPatterns = null; // Invalidate patterns cache
        UI.showToast('✅ Datos guardados correctamente', 'success');
        renderHistory(); // Update history immediately

        // Update Strong Numbers if user is on that tab
        const strongTab = document.querySelector('.tab-btn[data-tab="strong-number"]');
        if (strongTab && strongTab.classList.contains('active')) {
            renderStrongNumbers();
        }
        // Actualizar neto global tras guardar resultado de sorteo
        if (typeof updateGlobalNeto === 'function') updateGlobalNeto();
    } else {
        // If empty, maybe delete the day?
        if (db[currentDate]) {
            delete db[currentDate];
            localStorage.setItem(_dbKey(), JSON.stringify(db));
            sortedDatesCache = null; // Invalidate cache
            cachedPatterns = null; // Invalidate patterns cache
            UI.showToast('\uD83D\uDDD1\uFE0F Datos eliminados para este día', 'success');
            if (typeof updateGlobalNeto === 'function') updateGlobalNeto();
        }
    }
}

function clearCurrentDay() {
    UI.confirm(
        '\u00bfEst\u00e1s seguro de limpiar todos los campos de hoy?',
        function() {
            document.querySelectorAll('.number-input').forEach(function(input) { input.value = ''; });
            document.querySelectorAll('.slot-animal-name').forEach(function(label) { label.textContent = ''; });
        },
        null,
        '\ud83d\uddd1\ufe0f Limpiar D\u00eda'
    );
}

// Analysis Logic
function populateSelect() {
    if (!targetSelect) return;
    targetSelect.innerHTML = '<option value="" disabled selected>Selecciona un número</option>';
    var nums = getValidNumbers();
    nums.forEach(num => {
        const opt = document.createElement('option');
        opt.value = num;
        const animalName = getAnimalName(num);
        opt.textContent = animalName ? `${num} - ${animalName}` : num;
        targetSelect.appendChild(opt);
    });
}

function runAnalysis(target) {
    const sorted = calculateAssociations(target);
    renderAnalysisResults(sorted, target);
}

function calculateAssociations(target, referenceDate = null, prefilteredDates = null) {
    const associations = {};

    let recentDates;
    if (prefilteredDates) {
        recentDates = prefilteredDates;
    } else {
        const refDate = referenceDate || currentDate;
        const allDates = getSortedDates().filter(date => date < refDate);
        const daysBack = currentAppType === 'extendida' ? -25 : -15;
        recentDates = allDates.slice(daysBack);
    }

    recentDates.forEach(date => {
        const dayData = db[date];
        const numbersInDay = Object.values(dayData);

        if (numbersInDay.includes(target)) {
            // Deduplicate numbers to count only once per day
            const uniqueNumbers = [...new Set(numbersInDay)];

            uniqueNumbers.forEach(num => {
                if (num !== target) {
                    associations[num] = (associations[num] || 0) + 1;
                }
            });
        }
    });

    const maxAssoc = currentAppType === 'extendida' ? 20 : 10;
    return Object.entries(associations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxAssoc);
}

// Centralized Metrics Calculation (Jaula/Juicio)
function calculateJaulaMetrics(referenceDateStr) {
    const metrics = {}; // { number: { daysWithoutShow, status: 'jaula'|'juicio'|'normal', lastSeenDate } }

    // Initialize all metrics
    getValidNumbers().forEach(num => {
        metrics[num] = {
            daysWithoutShow: Infinity,
            status: 'normal',
            lastSeenDate: null
        };
    });

    // 1. Calculate Last Appearance for ALL numbers based on history BEFORE (or inclusive?) referenceDate?
    // Usually "Jaula" implies "current status". If refDate is today, we look at history up to yesterday?
    // Or do we include today?
    // Standard: If "today" is not complete, we look at history.
    // If we are looking purely at "records", we scan DB.

    // Get all dates from DB sorted
    // Filter dates <= referenceDate. 
    // Wait, if refDate is today, and today has data, does that count as "last seen"? Yes.
    const allDates = getSortedDates().filter(date => date <= referenceDateStr);

    allDates.forEach(date => {
        const dayData = db[date];
        const numbersInDay = Object.values(dayData);
        numbersInDay.forEach(rawNum => {
            if (rawNum) {
                const num = NumberUtils.normalize(rawNum);
                // Update last seen (since dates are sorted ascending, latest overwrites)
                if (metrics[num]) {
                    metrics[num].lastSeenDate = date;
                }
            }
        });
    });

    // 2. Calculate Days Diff and Assign Status
    getValidNumbers().forEach(rawNum => {
        const num = NumberUtils.normalize(rawNum);
        const metricsNum = metrics[num];

        if (metricsNum.lastSeenDate) {
            metricsNum.daysWithoutShow = DateUtils.daysBetween(metricsNum.lastSeenDate, referenceDateStr);
        } else {
            // Never seen
            metricsNum.daysWithoutShow = Infinity;
        }

        // Determine Status
        // FIX #2: >= 6 (not > 6) so day-6 numbers correctly enter Jaula
        if (metricsNum.daysWithoutShow >= 6) {
            metricsNum.status = 'jaula';
        } else if (metricsNum.daysWithoutShow >= 4 && metricsNum.daysWithoutShow <= 5) {
            metricsNum.status = 'juicio';
        } else {
            metricsNum.status = 'normal';
        }
    });

    return metrics;
}

// Helper specific for Strong Number (compatibility wrapper or direct usage)
function getJaulaSets(referenceDateStr) {
    const metrics = calculateJaulaMetrics(referenceDateStr);
    const jaula = new Set();
    const juicio = new Set();

    Object.keys(metrics).forEach(num => {
        if (metrics[num].status === 'jaula') jaula.add(num);
        if (metrics[num].status === 'juicio') juicio.add(num);
    });

    return { jaula, juicio };
}

// Strong Number Logic
function clearStrongSummaries() {
    var ids = ['repeated-associates','jaula-juicio-associates','validated-associates',
               'recommendations-list','convergencia-panel'];
    ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    // Hide pattern recommendations box
    var pr = document.getElementById('pattern-recommendations');
    if (pr) pr.style.display = 'none';
}

function renderStrongNumbers() {
    const container = document.getElementById('strong-number-grid');
    container.innerHTML = '';

    const dayData = db[currentDate] || {};
    const hours = Object.keys(dayData).sort((a, b) => parseInt(a) - parseInt(b));

    if (hours.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary)">No hay números registrados para hoy.</p>';
        clearStrongSummaries();
        return;
    }

    // Get search filter
    const searchInput = document.getElementById('strong-search-input');
    const searchTerm = searchInput ? searchInput.value.trim() : '';

    // Calculate Jaula/Juicio status as of currentDate
    const { jaula: jaulaSet, juicio: juicioSet } = getJaulaSets(currentDate);

    // 1. Calculate all associates for all numbers of the day
    const numberAssociatesMap = {};

    // PREFILTER DATES for calculateAssociations (Performance Optimization)
    const allDates = getSortedDates().filter(date => date < currentDate);
    const daysBack = currentAppType === 'extendida' ? -25 : -15;
    const recentDates = allDates.slice(daysBack);

    hours.forEach(hour => {
        const num = dayData[hour];
        const associates = calculateAssociations(num, currentDate, recentDates); // Pass prefiltered dates
        numberAssociatesMap[hour] = { num, associates };
    });

    // Calculate todaysNumbers once
    const todaysNumbers = new Set(Object.values(dayData).map(n => NumberUtils.normalize(n)));

    // Determine view mode manually
    const showPredictionLayer = currentViewMode === 'prediction';
    const showValidationLayer = currentViewMode === 'validation';

    // 2. Render
    hours.forEach(currentHour => {
        const { num, associates } = numberAssociatesMap[currentHour];
        const currentHourInt = parseInt(currentHour);

        // Filter Logic: If search term exists, check matches
        if (searchTerm) {
            let isMatch = false;
            // Check main number
            if (num === searchTerm) isMatch = true;
            // Check associates
            if (!isMatch) {
                isMatch = associates.some(assoc => assoc[0] === searchTerm);
            }
            // Skip if no match
            if (!isMatch) return;
        }

        // Check if this MAIN number was predicted by a PREVIOUS hour's associates (Observation Mode Header Logic)
        let isPredictedHeader = false;
        if (showValidationLayer) {
            for (const prevHour of hours) {
                const prevHourInt = parseInt(prevHour);
                if (prevHourInt < currentHourInt) {
                    // Check if current 'num' was in 'prevHour' associates
                    const prevAssociates = numberAssociatesMap[prevHour].associates;
                    const foundPrediction = prevAssociates.some(assoc => NumberUtils.areEqual(assoc[0], num));
                    if (foundPrediction) {
                        isPredictedHeader = true;
                        break;
                    }
                }
            }
        }

        const column = document.createElement('div');
        column.className = 'strong-column';

        // Header: Time and Number
        const header = document.createElement('div');
        // Apply class if predicted and in validation mode
        const headerClass = isPredictedHeader ? 'strong-header highlight-header-match' : 'strong-header';

        header.className = headerClass;
        const animalNameHeader = getAnimalName(num);
        header.innerHTML = `
            <span class="strong-time">${formatTime(currentHourInt)}</span>
            <span class="strong-main-number">${num}</span>
            ${animalNameHeader ? `<span class="strong-animal-name">${animalNameHeader}</span>` : ''}
        `;
        column.appendChild(header);

        // List of associates
        const list = document.createElement('div');
        list.className = 'strong-list';

        // First, count how many times each associate appears across all hours
        const associateFrequency = {};
        Object.values(numberAssociatesMap).forEach(({ associates }) => {
            associates.forEach(([assocNum]) => {
                associateFrequency[assocNum] = (associateFrequency[assocNum] || 0) + 1;
            });
        });

        associates.forEach(([assocNum]) => {
            let highlightClass = '';

            // LOGIC FOR VALIDATION MODE (previously isDayComplete)
            if (showValidationLayer) {
                // Iterate through all recorded hours for the day
                for (const resultHour of hours) {
                    const resultHourInt = parseInt(resultHour);
                    const resultNum = dayData[resultHour];

                    // If the associate matches a result number
                    if (NumberUtils.areEqual(assocNum, resultNum)) {
                        // And that result happened AFTER the current prediction time
                        if (resultHourInt > currentHourInt) {
                            highlightClass = 'highlight-match'; // Verde por validación
                            break; // Found a match
                        }
                    }
                }
            }

            // LOGIC FOR PREDICTION MODE (previously !isDayComplete)
            // Note: In manual Prediction mode, we show frequency colors regardless of day completion
            if (showPredictionLayer) {
                // BUT exclude numbers that already appeared in today's results (optional, but good for prediction)
                // Actually, standard prediction usually excludes numbers already out for the general pool, 
                // but for specific associate table, we just highlight frequency.

                if (!todaysNumbers.has(NumberUtils.normalize(assocNum))) {
                    const frequency = associateFrequency[assocNum] || 1;
                    if (frequency >= 4) {
                        highlightClass = 'highlight-green'; // Verde por frecuencia
                    } else if (frequency >= 2) {
                        highlightClass = 'highlight-purple'; // Morado por frecuencia
                    }
                }
            }

            const item = document.createElement('div');
            item.className = `strong-item ${highlightClass}`;

            // Logic for applying Jaula/Juicio colors:
            // Prediction Mode -> Always show alerts (to warn).
            // Validation Mode -> Only show alerts if the number matched matches validation (to show success).
            const isMatch = highlightClass === 'highlight-match';
            const shouldShowAlert = (showPredictionLayer) || (showValidationLayer && isMatch);

            if (shouldShowAlert) {
                if (jaulaSet.has(assocNum)) {
                    // Jaula: Red styling
                    item.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                    item.style.color = '#f87171';
                    item.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                } else if (juicioSet.has(assocNum)) {
                    // Juicio: Yellow styling
                    item.style.backgroundColor = 'rgba(234, 179, 8, 0.2)';
                    item.style.color = '#facc15';
                    item.style.borderColor = 'rgba(234, 179, 8, 0.3)';
                }
            }

            item.textContent = assocNum;
            list.appendChild(item);
        });

        column.appendChild(list);
        container.appendChild(column);
    });

    // 3. Generate summary of repeated associates
    const repeatedAssociatesContainer = document.getElementById('repeated-associates');
    if (repeatedAssociatesContainer) {
        repeatedAssociatesContainer.innerHTML = '';

        // Collect all associates from all hours
        const allAssociates = [];
        Object.values(numberAssociatesMap).forEach(({ associates }) => {
            associates.forEach(([assocNum]) => allAssociates.push(assocNum));
        });

        // Count frequencies
        const frequencyMap = {};
        allAssociates.forEach(num => {
            frequencyMap[num] = (frequencyMap[num] || 0) + 1;
        });

        // Get all result numbers for validation
        const resultNumbers = new Set(Object.values(dayData).map(n => NumberUtils.normalize(n)));

        // Sort by frequency (descending) and filter out numbers that already appeared
        // in results OR are currently in Jaula/Juicio (cold numbers, not recommended)
        const sortedByFrequency = Object.entries(frequencyMap)
            .filter(([num]) => !resultNumbers.has(NumberUtils.normalize(num)))   // Exclude numbers already out today
            .filter(([num]) => !jaulaSet.has(num) && !juicioSet.has(num))         // Exclude cold numbers (Jaula/Juicio)
            .sort((a, b) => b[1] - a[1]);

        // Render the list
        if (sortedByFrequency.length === 0) {
            repeatedAssociatesContainer.innerHTML = '<span style="color: var(--text-secondary)">No hay asociados para mostrar</span>';
        } else {
            sortedByFrequency.forEach(([num, count]) => {
                const badge = document.createElement('span');
                badge.className = 'associate-badge';

                // Apply color based on frequency
                if (count >= 4) {
                    badge.classList.add('frequency-high'); // Verde
                } else if (count >= 2) {
                    badge.classList.add('frequency-medium'); // Morado (updated)
                }

                badge.innerHTML = `${num} <small>(${count})</small>`;
                repeatedAssociatesContainer.appendChild(badge);
            });
        }
    }

    // 4. Generate summary of Jaula/Juicio Associates (NEW)
    const jaulaJuicioContainer = document.getElementById('jaula-juicio-associates');
    if (jaulaJuicioContainer) {
        jaulaJuicioContainer.innerHTML = '';

        // Flatten all unique associates
        const uniqueAssociates = new Set();
        Object.values(numberAssociatesMap).forEach(({ associates }) => {
            associates.forEach(([assocNum]) => uniqueAssociates.add(assocNum));
        });

        const jaulaJuicioAssociates = [];
        // Get numbers that appeared today to exclude them
        const todaysResults = new Set(Object.values(dayData).map(n => NumberUtils.normalize(n)));

        uniqueAssociates.forEach(num => {
            // If already appeared, don't show here (it's shown in Validated Associates)
            if (todaysResults.has(NumberUtils.normalize(num))) return;

            if (jaulaSet.has(num)) {
                jaulaJuicioAssociates.push({ num, type: 'jaula', label: '🔒' });
            } else if (juicioSet.has(num)) {
                jaulaJuicioAssociates.push({ num, type: 'juicio', label: '⚖️' });
            }
        });

        if (jaulaJuicioAssociates.length === 0) {
            jaulaJuicioContainer.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">Ningún asociado en jaula o juicio.</span>';
        } else {
            // Sort: Jaula first, then Juicio
            jaulaJuicioAssociates.sort((a, b) => {
                if (a.type === b.type) return 0;
                return a.type === 'jaula' ? -1 : 1;
            });

            jaulaJuicioAssociates.forEach(item => {
                const badge = document.createElement('div');
                badge.className = 'associate-badge';

                if (item.type === 'jaula') {
                    // Red for Jaula
                    badge.style.background = 'rgba(239, 68, 68, 0.2)';
                    badge.style.color = '#f87171';
                    badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                } else {
                    // Yellow for Juicio
                    badge.style.background = 'rgba(234, 179, 8, 0.2)';
                    badge.style.color = '#facc15';
                    badge.style.borderColor = 'rgba(234, 179, 8, 0.3)';
                }

                badge.innerHTML = `${item.num} <small>${item.label}</small>`;
                jaulaJuicioContainer.appendChild(badge);
            });
        }
    }

    // 5. Generate summary of validated repeated associates
    const validatedAssociatesContainer = document.getElementById('validated-associates');
    if (validatedAssociatesContainer) {
        validatedAssociatesContainer.innerHTML = '';

        // Build a map of which numbers appeared as associates for each hour
        const associatesByHour = {};
        hours.forEach(hour => {
            const { associates } = numberAssociatesMap[hour];
            associatesByHour[hour] = new Set(associates.map(([num]) => num));
        });

        // Track validated associates with their frequency
        const validatedMap = {};

        // For each hour, check if its associates appeared in results AFTER that hour
        hours.forEach(predictionHour => {
            const predictionHourInt = parseInt(predictionHour);
            const associatesForThisHour = associatesByHour[predictionHour];

            // Check each associate
            associatesForThisHour.forEach(assocNum => {
                // Look for this associate in the results
                for (const resultHour of hours) {
                    const resultHourInt = parseInt(resultHour);
                    const resultNum = dayData[resultHour];

                    // If the associate matches a result number
                    if (NumberUtils.areEqual(assocNum, resultNum)) {
                        // Only count if result appeared AFTER the prediction time (not at the same time or before)
                        if (resultHourInt > predictionHourInt) {
                            validatedMap[assocNum] = (validatedMap[assocNum] || 0) + 1;
                        }
                        break; // Found the number, no need to check other hours
                    }
                }
            });
        });

        // Sort by frequency
        const validatedRepeated = Object.entries(validatedMap)
            .sort((a, b) => b[1] - a[1]);

        // Render the list
        if (validatedRepeated.length === 0) {
            validatedAssociatesContainer.innerHTML = '<span style="color: var(--text-secondary)">No hay asociados validados</span>';
        } else {
            validatedRepeated.forEach(([num, count]) => {
                const badge = document.createElement('span');
                badge.className = 'associate-badge validated';

                // Color override: Check if validated associate is also in Jaula or Juicio
                if (jaulaSet.has(num)) {
                    // Jaula style override
                    badge.style.background = 'rgba(239, 68, 68, 0.2)';
                    badge.style.color = '#f87171';
                    badge.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                } else if (juicioSet.has(num)) {
                    // Juicio style override
                    badge.style.background = 'rgba(234, 179, 8, 0.2)';
                    badge.style.color = '#facc15';
                    badge.style.borderColor = 'rgba(234, 179, 8, 0.3)';
                }

                badge.innerHTML = `${num} <small>(${count})</small>`;
                validatedAssociatesContainer.appendChild(badge);
            });
        }
    }

    // ── Convergencia de Señales ──────────────────────────────────────────────
    // PASO 1: Calcular assocRecommended sincrónicamente (ya tenemos los datos)
    const assocRecommended = new Set();
    {
        const allAssoc = [];
        Object.values(numberAssociatesMap).forEach(function(h) {
            h.associates.forEach(function(a) { allAssoc.push(a[0]); });
        });
        const freqMap = {};
        allAssoc.forEach(function(n) { freqMap[n] = (freqMap[n] || 0) + 1; });
        const todayNums = new Set(Object.values(dayData).map(function(n) { return NumberUtils.normalize(n); }));
        Object.entries(freqMap).forEach(function(e) {
            var n = e[0], cnt = e[1];
            if (cnt >= 2 && !todayNums.has(NumberUtils.normalize(n)) && !jaulaSet.has(n) && !juicioSet.has(n)) {
                assocRecommended.add(n);
            }
        });
    }

    // PASO 2: Capturar dayData para la closure (antes de que cambie)
    const _dayDataConv = dayData;

    // PASO 3: Actualizar patrones Y, cuando estén listos, calcular convergencia completa
    // (patternRecommended depende de cachedPatterns que llena updatePatternRecommendations)
    updatePatternRecommendations().then(function() {

        // 3a. Números del ALGORITMO DE FECHA (pirámide) — global, accesible aquí
        const fechaNums = new Set();
        if (currentExtracted) {
            ['horiz','horizRev','vert','diag','special00'].forEach(function(k) {
                (currentExtracted[k] || []).forEach(function(item) { fechaNums.add(item.num); });
            });
        }

        // 3b. Números recomendados por PATRONES (ahora cachedPatterns ya está poblado)
        const patternRecommended = new Set();
        if (cachedPatterns && cachedPatterns.length > 0) {
            const todayNums2 = new Set(
                Object.values(_dayDataConv)
                    .filter(function(n) { return n && n.trim() !== ''; })
                    .map(function(n) { return NumberUtils.normalize(n); })
            );
            cachedPatterns.forEach(function(pattern) {
                const patSet = new Set(pattern.numbers);
                const inter  = new Set([...patSet].filter(function(x) { return todayNums2.has(x); }));
                if (inter.size >= 2 && inter.size < patSet.size) {
                    pattern.numbers
                        .filter(function(x) { return !todayNums2.has(x); })
                        .forEach(function(x) { patternRecommended.add(x); });
                }
            });
        }

        // 3c. Renderizar la convergencia con los 3 sets completos
        renderConvergencia(fechaNums, assocRecommended, patternRecommended);
    }); // end .then()
} // end renderStrongNumbers

// ── Panel de Convergencia de Señales ────────────────────────────────────────
function renderConvergencia(fechaNums, assocNums, patternNums) {
    var el = document.getElementById('convergencia-panel');
    if (!el) return;

    // Categorizar cada número de la pirámide según confluencia
    var triple  = [];  // Fecha + Asoc + Patrón
    var fecAsoc = [];  // Fecha + Asoc  (solo)
    var fecPat  = [];  // Fecha + Patrón (solo)

    fechaNums.forEach(function(num) {
        var inAssoc   = assocNums.has(num);
        var inPattern = patternNums.has(num);
        if (inAssoc && inPattern)   triple.push(num);
        else if (inAssoc)           fecAsoc.push(num);
        else if (inPattern)         fecPat.push(num);
    });

    // Cuarto tier: Asoc + Patrón sin Fecha (no están en fechaNums)
    var assocPat = [];
    assocNums.forEach(function(num) {
        if (patternNums.has(num) && !fechaNums.has(num)) {
            assocPat.push(num);
        }
    });

    // Ordenar numéricamente (00 primero)
    function sortNums(arr) {
        return arr.sort(function(a, b) {
            if (a === '00') return -1;
            if (b === '00') return 1;
            return parseInt(a,10) - parseInt(b,10);
        });
    }
    sortNums(triple); sortNums(fecAsoc); sortNums(fecPat); sortNums(assocPat);

    var hasAny = triple.length > 0 || fecAsoc.length > 0 || fecPat.length > 0 || assocPat.length > 0;

    if (!hasAny) {
        el.innerHTML = '<span class="conv-empty">&#128313; Abre la pesta&#241;a <strong>Fechas</strong> primero para activar la convergencia.</span>';
        return;
    }

    function chipHTML(num, typeClass) {
        var animal = getAnimalName(num);
        return '<div class="conv-chip ' + typeClass + '">' +
               '<span class="conv-chip-num">' + num + '</span>' +
               (animal ? '<span class="conv-chip-name">' + animal + '</span>' : '') +
               '</div>';
    }

    function tierHTML(label, icon, nums, typeClass, desc) {
        if (nums.length === 0) return '';
        return '<div class="conv-tier ' + typeClass + '">' +
               '<div class="conv-tier-header">' +
               '<span class="conv-tier-icon">' + icon + '</span>' +
               '<span class="conv-tier-label">' + label + '</span>' +
               '<span class="conv-tier-count">' + nums.length + '</span>' +
               '</div>' +
               '<div class="conv-tier-desc">' + desc + '</div>' +
               '<div class="conv-chips">' +
               nums.map(function(n) { return chipHTML(n, typeClass); }).join('') +
               '</div>' +
               '</div>';
    }

    el.innerHTML =
        tierHTML('Triple Convergencia',  '&#128293;', triple,   'tier-triple',
                 'Recomendado por Fecha + Asociados + Patr&#243;n') +
        tierHTML('Fecha + Asociados',    '&#9889;',   fecAsoc,  'tier-asoc',
                 'Recomendado por el algoritmo de fecha y los asociados repetidos') +
        tierHTML('Fecha + Patr&#243;n', '&#10024;',  fecPat,   'tier-pat',
                 'Recomendado por el algoritmo de fecha y un patr&#243;n activo') +
        tierHTML('Asociados + Patr&#243;n', '&#127919;', assocPat, 'tier-asoc-pat',
                 'Coincidencia entre asociados repetidos y patr&#243;n activo (sin respaldo de fecha)');
}

// Jaula and Juicio Logic - Numbers without appearances
function renderJaula() {
    const jaulaContainer = document.getElementById('jaula-grid');
    const juicioContainer = document.getElementById('juicio-grid');

    if (!jaulaContainer || !juicioContainer) return;

    jaulaContainer.innerHTML = '';
    juicioContainer.innerHTML = '';

    const metrics = calculateJaulaMetrics(currentDate);
    const jaulaNumbers = [];
    const juicioNumbers = [];

    // Iterate over the dynamically correct valid numbers list for the active mode
    getValidNumbers().forEach(rawNum => {
        const num = NumberUtils.normalize(rawNum);
        const meta = metrics[num];

        // Skip hidden/invalid if any? No, metrics covers all.

        const item = {
            number: num,
            days: meta.daysWithoutShow,
            lastSeen: meta.lastSeenDate
        };

        if (meta.status === 'jaula') {
            jaulaNumbers.push(item);
        } else if (meta.status === 'juicio') {
            juicioNumbers.push(item);
        }
    });

    // Sort by days (descending)
    const sortFunction = (a, b) => {
        if (a.days === Infinity && b.days === Infinity) return 0;
        if (a.days === Infinity) return -1;
        if (b.days === Infinity) return 1;
        return b.days - a.days;
    };

    jaulaNumbers.sort(sortFunction);
    juicioNumbers.sort(sortFunction);

    // Render Juicio results
    if (juicioNumbers.length === 0) {
        juicioContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">✅ No hay números en juicio. Ningún número tiene entre 4 y 5 días sin salir.</p>';
    } else {
        juicioNumbers.forEach(item => {
            const card = document.createElement('div');
            card.className = 'juicio-card';

            const daysText = `${item.days} días`;
            const lastSeenText = item.lastSeen || 'Nunca';
            const animalName = getAnimalName(item.number);

            card.innerHTML = `
                <div class="juicio-number">${item.number}</div>
                ${animalName ? `<div class="card-animal-name">${animalName}</div>` : ''}
                <div class="juicio-days">${daysText}</div>
                <div class="juicio-last-seen">Último: ${lastSeenText}</div>
            `;

            juicioContainer.appendChild(card);
        });
    }

    // Render Jaula results
    if (jaulaNumbers.length === 0) {
        jaulaContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">✅ No hay números en la jaula. Todos han salido en los últimos 6 días.</p>';
    } else {
        jaulaNumbers.forEach(item => {
            const card = document.createElement('div');
            card.className = 'jaula-card';

            const daysText = item.days === Infinity ? 'Nunca' : `${item.days} días`;
            const lastSeenText = item.lastSeen ? item.lastSeen : 'Nunca';
            const animalName = getAnimalName(item.number);

            card.innerHTML = `
                <div class="jaula-number">${item.number}</div>
                ${animalName ? `<div class="card-animal-name">${animalName}</div>` : ''}
                <div class="jaula-days">${daysText}</div>
                <div class="jaula-last-seen">Último: ${lastSeenText}</div>
            `;

            jaulaContainer.appendChild(card);
        });
    }
}

function _updateAnalysisHeader() {
    var el = document.getElementById('analysis-header-title');
    if (!el) return;
    var topN  = currentAppType === 'extendida' ? 20 : 10;
    var diasN = currentAppType === 'extendida' ? 25 : 15;
    el.textContent = 'Top ' + topN + ' Asociados (\u00DAltimos ' + diasN + ' d\u00EDas)';
}

function renderAnalysisResults(results, target) {
    const container = document.getElementById('results-container');
    container.classList.remove('results-hidden');
    statsGrid.innerHTML = '';
    
    // Update header to show the selected target number and animal name
    const headerTitle = container.querySelector('h3');
    if (headerTitle) {
        const animalName = getAnimalName(target);
        const topN   = currentAppType === 'extendida' ? 20 : 10;
        const diasN  = currentAppType === 'extendida' ? 25 : 15;
        headerTitle.textContent = `Top ${topN} Asociados para ${target}${animalName ? ` - ${animalName}` : ''} (Últimos ${diasN} días)`;
    }

    if (results.length === 0) {
        statsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary)">No hay datos suficientes para este número aún.</p>';
        return;
    }

    results.forEach(([num, count], index) => {
        const card = document.createElement('div');
        card.className = 'stat-card';
        const animalName = getAnimalName(num);
        card.innerHTML = `
            <div class="rank-badge">#${index + 1}</div>
            <div class="stat-number">${num}</div>
            ${animalName ? `<div class="stat-animal-name">${animalName}</div>` : ''}
            <div class="stat-count">${count} veces</div>
        `;
        statsGrid.appendChild(card);
    });
}

// History Logic
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historial_' + currentMode.toUpperCase() + '_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
});

const syncWebBtn = document.getElementById('sync-web-btn');
if (syncWebBtn) {
    syncWebBtn.addEventListener('click', async () => {
        const originalText = syncWebBtn.innerHTML;
        syncWebBtn.innerHTML = '⏳ Sincronizando...';
        syncWebBtn.disabled = true;

        try {
            // Ejemplo de URL final: "https://.../data/sync_lotto.json"
            const url = SERVIDOR_SYNC + 'sync_' + currentMode + '.json?t=' + Date.now(); // Cache-buster
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ' - ¿Subiste el archivo a tu servidor?');
            }

            const data = await response.json();
            
            // Validate it's a valid data object (not wrapped anymore)
            if (typeof data !== 'object' || data === null || Array.isArray(data)) {
                throw new Error('Formato de datos no válido del servidor.');
            }

            // Auto-migrate if the server sends wrapped data (backward compat)
            const dbKey = 'lottery_data_' + currentMode;
            const imported = data[dbKey] ? data[dbKey] : data;
            
            // Combinar con la base de datos local
            let addedCount = 0;
            for (let date in imported) {
                if (!db[date]) db[date] = {};
                for (let h in imported[date]) {
                    db[date][h] = imported[date][h];
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                localStorage.setItem('lottery_data_' + currentMode, JSON.stringify(db)); // Guarda la bd en localStorage
                renderHistory();
                loadDayData(currentDate);
                UI.showToast('¡Sincronización exitosa! Se actualizaron ' + addedCount + ' resultados desde tu servidor central.', 'success');
            } else {
                UI.showToast('Sincronización correcta, pero no se encontraron resultados nuevos para añadir.', 'info');
            }

        } catch (error) {
            console.error('Error de sincronización:', error);
            UI.showToast('Error al sincronizar con ' + SERVIDOR_SYNC + '\n\nAsegúrate de ejecutar el scraper de Python y subir el archivo "sync_' + currentMode + '.json" a tu servidor.\n\nDetalle: ' + error.message, 'error');
        } finally {
            syncWebBtn.innerHTML = originalText;
            syncWebBtn.disabled = false;
        }
    });
}

importBtn.addEventListener('click', function() { importFile.click(); });


importFile.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if (!file) return;

    // Reset input so the same file can be re-imported later
    e.target.value = '';

    // Validate file extension before reading
    var fileName = file.name || '';
    if (fileName.toLowerCase().indexOf('.json') === -1) {
        UI.showToast('Error: El archivo debe tener extension .json', 'error');
        return;
    }

    var reader = new FileReader();

    reader.onerror = function() {
        UI.showToast('Error: No se pudo leer el archivo. Intenta de nuevo.', 'error');
    };

    reader.onload = function() {
        // Use reader.result directly (more compatible than event.target.result on old browsers)
        var rawText = reader.result;
        try {
            // Remove BOM if present (Windows 7 Notepad adds BOM to UTF-8 files)
            if (rawText.charCodeAt(0) === 0xFEFF) {
                rawText = rawText.slice(1);
            }

            var imported = JSON.parse(rawText);

            // Validate imported data structure
            if (typeof imported !== 'object' || imported === null || Array.isArray(imported)) {
                UI.showToast('Error: Formato de datos invalido. El archivo no contiene un objeto JSON valido.', 'error');
                return;
            }

            // Check at least one date key exists
            var keys = Object.keys(imported);
            if (keys.length === 0) {
                UI.showToast('Advertencia: El archivo esta vacio (no contiene registros).', 'warning');
                return;
            }

            UI.confirm('Esto reemplazar\u00e1 tus datos actuales (' + keys.length + ' d\u00edas encontrados). \u00bfContinuar?', function() {
                db = imported;
                localStorage.setItem('lottery_data_' + currentMode, JSON.stringify(db));
                sortedDatesCache = null;
                cachedPatterns = null;
                renderHistory();
                loadDayData(currentDate);
                UI.showToast('Datos importados correctamente. ' + keys.length + ' dias cargados.', 'success');
            }, null, '\ud83d\udce5 Importar Datos');
        } catch (err) {
            console.error('Error importing data:', err);
            UI.showToast('Error al procesar el archivo JSON: ' + (err.message || 'formato invalido'), 'error');
        }
    };

    // Explicit UTF-8 encoding — critical for Windows 7 where system default may be CP-1252
    reader.readAsText(file, 'UTF-8');
});

function renderHistory(searchFilter = '') {
    historyBody.innerHTML = '';

    // Sort dates descending
    const dates = [...getSortedDates()].reverse();

    dates.forEach(date => {
        const row = document.createElement('tr');
        const dayData = db[date];

        // Check if this row contains the search number
        // FIX #3: Normalize both query and stored values so "5" and "05" match
        let matchesSearch = !searchFilter; // If no filter, show all
        if (searchFilter) {
            const normFilter = NumberUtils.normalize(searchFilter);
            matchesSearch = Object.values(dayData).some(v => NumberUtils.normalize(v) === normFilter);
        }

        // Skip this row if it doesn't match the search
        if (!matchesSearch) return;

        let html = `<td>${date}</td>`;

        for (let hour = START_HOUR; hour <= END_HOUR; hour++) {
            const val = dayData[hour] || '-';
            // Highlight the searched number
            if (searchFilter && NumberUtils.normalize(val) === NumberUtils.normalize(searchFilter)) {
                html += `<td style="background: rgba(234, 179, 8, 0.3); font-weight: 700;">${val}</td>`;
            } else {
                html += `<td>${val}</td>`;
            }
        }

        row.innerHTML = html;
        historyBody.appendChild(row);
    });

    // Show message if no results
    if (searchFilter && historyBody.children.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="13" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No se encontraron resultados para "${searchFilter}"</td>`;
        historyBody.appendChild(row);
    }
}

// Mode Switching Logic
function switchMode(newMode) {
    // Prevent race condition if already switching
    if (isSwitchingMode) {
        console.warn('Mode switch already in progress, please wait');
        return;
    }

    // Prevent switching to the same mode
    if (newMode === currentMode) {
        console.log('Already in this mode');
        return;
    }

    isSwitchingMode = true;

    try {
        // Save current mode data
        try {
            localStorage.setItem(_dbKey(), JSON.stringify(db));
        } catch (error) {
            console.error('Error saving current mode data:', error);
            UI.showToast('Error al guardar los datos del modo actual. Verifica el espacio disponible.', 'error');
            return;
        }

        // Update mode
        currentMode = newMode;
        localStorage.setItem(_modeKey(), currentMode);

        // Load new mode data
        db = safeLoadData(_dbKey());
        sortedDatesCache = null; // Invalidate cache
        cachedPatterns = null; // Invalidate patterns cache

        // Refresh all UI
        loadDayData(currentDate);
        renderHistory();

        // Clear analysis results
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer) {
            resultsContainer.classList.add('results-hidden');
        }

        // Clear strong numbers
        const strongGrid = document.getElementById('strong-number-grid');
        if (strongGrid) {
            strongGrid.innerHTML = '';
        }

        // Reset target select
        if (targetSelect) {
            targetSelect.value = '';
        }

        // Show confirmation
        console.log(`Modo cambiado a: ${newMode}`);
        // Actualizar neto global al cambiar modo
        if (typeof updateGlobalNeto === 'function') updateGlobalNeto();
    } finally {
        // Always release the lock, even if an error occurred
        isSwitchingMode = false;
    }
}

// Help Menu Logic
function setupHelpMenu() {
    const helpBtn = document.getElementById('help-btn');
    const helpMenu = document.getElementById('help-menu');
    const closeHelpBtn = document.getElementById('close-help');
    const sectionBtns = document.querySelectorAll('.help-section-btn');

    // Toggle help menu
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            helpMenu.classList.toggle('hidden');
        });
    }

    // Close help menu
    if (closeHelpBtn) {
        closeHelpBtn.addEventListener('click', () => {
            helpMenu.classList.add('hidden');
        });
    }

    // Switch between help sections
    sectionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;

            // Update active button
            sectionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update active content
            document.querySelectorAll('.help-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${section}-content`).classList.add('active');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!helpMenu.contains(e.target) && !helpBtn.contains(e.target)) {
            helpMenu.classList.add('hidden');
        }
    });
}

// ── Start: show launcher instead of directly initializing ────────────────
// El script se carga al final del body, por lo que el DOM ya está listo.
// showLauncher(); // Se movió al validateLogin()

// Twemoji: convertir emojis nativos en imágenes SVG compatibles con Windows 7
initTwemoji();


// --- Pattern Analysis Tool Logic ---



async function analyzePatterns() {
    const container = document.getElementById('patterns-container');
    if (!container) return;

    const refDate = currentDate;

    // Check cache first
    if (cachedPatterns) {
        renderPatterns(cachedPatterns, refDate);
        return;
    }

    const parts = refDate.split('-');
    const label = parts[2] + '/' + parts[1] + '/' + parts[0];

    container.innerHTML =
        '<div class="analyzing-loader">' +
        '<div class="spinner"></div>' +
        '<p>Analizando 60 d&#237;as antes de ' + label + '...</p>' +
        '</div>';

    await new Promise(function(r) { setTimeout(r, 50); });

    try {
        var patternDays = currentAppType === 'extendida' ? 90 : 60;
        cachedPatterns = await findPatternsAsync(patternDays, 5, refDate);
        renderPatterns(cachedPatterns, refDate);
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color: var(--danger)">Error al analizar: ' + e.message + '</p>';
    }
}


async function findPatternsAsync(daysToAnalyze, minFrequency, refDate) {
    // Usar refDate como extremo FINAL del an&#225;lisis (fecha seleccionada).
    // Se analizan los 60 d&#237;as ANTES de esa fecha, excluy&#233;ndola.
    var refStr    = refDate || currentDate;
    var refD      = new Date(refStr + 'T12:00:00');
    var cutoff    = new Date(refD);
    cutoff.setDate(cutoff.getDate() - daysToAnalyze);
    var cutoffStr = cutoff.toISOString().split('T')[0];

    // 1. Preparar datos: solo fechas en [cutoffStr, refStr)  (refStr excluida)
    var datesToAnalyze = getSortedDates().filter(function(dateStr) {
        return dateStr >= cutoffStr && dateStr < refStr;
    });

    const rawData = datesToAnalyze.map(date => {
        const hours = db[date];
        const uniqueNumbers = new Set(Object.values(hours).filter(v => v && v.trim() !== ''));
        // Use numerical sort for consistency (e.g., '2' comes before '10')
        return { date, numbers: Array.from(uniqueNumbers).sort((a, b) => parseInt(a) - parseInt(b)) };
    })
    .filter(day => day.numbers.length >= 3); // Minimal valuable pattern size is 3

    if (rawData.length === 0) return [];

    const patternCounts = new Map(); // Key: "num,num", Value: {count, dates, numbers}
    const SIZES = [5, 4, 3]; // Order doesn't strictly matter for correctness, but we check all

    // 2. Process in Chunks (Avoid UI Freeze)
    const CHUNK_SIZE = 5; // Process 5 days per "tick"

    for (let i = 0; i < rawData.length; i += CHUNK_SIZE) {
        const chunk = rawData.slice(i, i + CHUNK_SIZE);

        // Heavy processing block
        chunk.forEach(day => {
            SIZES.forEach(size => {
                if (day.numbers.length < size) return;

                const combos = getCombinations(day.numbers, size);
                combos.forEach(combo => {
                    const key = combo.join(',');

                    let entry = patternCounts.get(key);
                    if (!entry) {
                        entry = { count: 0, dates: [], numbers: combo };
                        patternCounts.set(key, entry);
                    }
                    entry.count++;
                    entry.dates.push(day.date);
                });
            });
        });

        // Yield control back to main thread to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 3. Filter and Sort
    return Array.from(patternCounts.values())
        .filter(p => p.count >= minFrequency)
        .sort((a, b) => b.count - a.count);
}

function getCombinations(arr, k) {
    const results = [];

    // Iterative approach can be slightly faster/safer for stack depth, 
    // but recursive is fine for K <= 5. Keeping concise recursive version.
    function helper(start, combo) {
        if (combo.length === k) {
            results.push([...combo]);
            return;
        }
        // Optimization: Stop if remaining elements are not enough to fill k
        const remaining = k - combo.length;
        const available = arr.length - start;
        if (available < remaining) return;

        for (let i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            helper(i + 1, combo);
            combo.pop();
        }
    }
    helper(0, []);
    return results;
}

function renderPatterns(patterns, refDate) {
    const container = document.getElementById('patterns-container');
    if (patterns.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <p>No se encontraron patrones con m&#225;s de 5 repeticiones en los 60 d&#237;as anteriores a la fecha seleccionada.</p>
            </div>
        `;
        return;
    }

    // ── Verificar cumplimiento en la fecha de referencia ────────────────────
    var dayNums = new Set();
    if (refDate && db[refDate]) {
        Object.values(db[refDate]).forEach(function(v) {
            if (v && v.trim() !== '') dayNums.add(NumberUtils.normalize(v));
        });
    }

    // Marcar cada patron como cumplido (todos sus numeros aparecieron en refDate)
    var withStatus = patterns.map(function(p) {
        var fulfilled = dayNums.size > 0 && p.numbers.length > 0 &&
                        p.numbers.every(function(n) { return dayNums.has(NumberUtils.normalize(n)); });
        return Object.assign({}, p, { fulfilled: fulfilled });
    });

    var fulfilledCount = withStatus.filter(function(p) { return p.fulfilled; }).length;

    // ── Banner de resumen ────────────────────────────────────────────────────
    var parts   = refDate ? refDate.split('-') : [];
    var dateLabel = parts.length === 3 ? (parts[2] + '/' + parts[1] + '/' + parts[0]) : (refDate || '');
    var bannerHTML = '';
    if (dayNums.size > 0) {
        if (fulfilledCount > 0) {
            bannerHTML = '<div class="pattern-fulfillment-banner fulfilled">' +
                '&#10003; ' + fulfilledCount + ' patr' + (fulfilledCount === 1 ? 'ón' : 'ones') +
                ' cumplido' + (fulfilledCount === 1 ? '' : 's') + ' el ' + dateLabel +
                '</div>';
        } else {
            bannerHTML = '<div class="pattern-fulfillment-banner none">' +
                '&#9675; Ning&#250;n patr&#243;n se complet&#243; el ' + dateLabel +
                '</div>';
        }
    } else {
        bannerHTML = '<div class="pattern-fulfillment-banner no-data">' +
            '&#128313; Sin registros para ' + dateLabel + ' &#8212; no se puede verificar cumplimiento' +
            '</div>';
    }

    var refInfo = '<div class="pattern-ref-date">&#128336; Patrones calculados con los 60 d&#237;as anteriores al ' + dateLabel + '</div>';

    container.innerHTML = refInfo + bannerHTML + withStatus.map(function(p, index) {
        var animalNums = p.numbers.map(function(n) {
            var animalName = getAnimalName(n);
            return '<div class="pattern-number' + (p.fulfilled ? ' pattern-num-highlight' : '') +
                   '" data-num="' + n + '">' + n +
                   (animalName ? '<span class="pattern-animal-name">' + animalName + '</span>' : '') +
                   '</div>';
        }).join('');

        return '<div class="pattern-card' + (p.fulfilled ? ' pattern-card-fulfilled' : '') +
               '" data-numbers="' + p.numbers.join(',') + '">' +
               '<div class="pattern-header">' +
               '<span class="pattern-badge">#' + (index + 1) + ' - ' + p.numbers.length + ' N&#250;ms</span>' +
               '<div style="display:flex;gap:0.5rem;align-items:center;">' +
               (p.fulfilled ? '<span class="pattern-fulfilled-badge">&#10003; Cumplido</span>' : '') +
               '<div class="pattern-frequency"><strong>' + p.count + '</strong> veces</div>' +
               '</div></div>' +
               '<div class="pattern-numbers">' + animalNums + '</div>' +
               '<div class="pattern-dates"><ul>' +
               p.dates.slice(0, 5).map(function(d) { return '<li>' + formatDateShort(d) + '</li>'; }).join('') +
               (p.dates.length > 5 ? '<li>+' + (p.dates.length - 5) + ' m&#225;s...</li>' : '') +
               '</ul></div></div>';
    }).join('');

    // Aplicar filtro de busqueda si habia uno activo
    setupPatternsSearch();
}


// ── Búsqueda en Patrones ─────────────────────────────────────────────────────
function setupPatternsSearch() {
    var input    = document.getElementById('patterns-search-input');
    var clearBtn = document.getElementById('patterns-search-clear');
    if (!input) return;

    // Clone to remove old listeners
    var newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    // Block non-numeric chars on keypress (allow: backspace, delete, arrows, tab)
    newInput.addEventListener('keypress', function(e) {
        var char = String.fromCharCode(e.which || e.keyCode);
        if (!/[0-9]/.test(char)) e.preventDefault();
    });

    newInput.addEventListener('input', function() {
        // Strip any non-digit that may have slipped through (paste, etc.)
        var clean = newInput.value.replace(/[^0-9]/g, '');
        if (clean !== newInput.value) newInput.value = clean;
        filterPatterns();
    });

    if (clearBtn) {
        var newClear = clearBtn.cloneNode(true);
        clearBtn.parentNode.replaceChild(newClear, clearBtn);
        newClear.addEventListener('click', function() {
            newInput.value = '';
            filterPatterns();
            newInput.focus();
        });
    }

    filterPatterns();
}

function filterPatterns() {
    var input    = document.getElementById('patterns-search-input');
    var countEl  = document.getElementById('patterns-search-count');
    var clearBtn = document.getElementById('patterns-search-clear');
    var barEl    = document.getElementById('patterns-search-bar');
    var errorEl  = document.getElementById('patterns-search-error');
    var query    = input ? input.value.trim() : '';

    var cards = document.querySelectorAll('#patterns-container .pattern-card');

    // ── Clear button visibility ──────────────────────────────────────────
    if (clearBtn) clearBtn.style.display = query ? 'inline-block' : 'none';

    // ── Reset state helper ───────────────────────────────────────────────
    function resetCards() {
        cards.forEach(function(card) {
            card.style.opacity = '';
            card.style.outline = '';
            card.style.transform = '';
            card.querySelectorAll('.pattern-number').forEach(function(el) {
                el.classList.remove('pattern-num-highlight');
                el.style.background = '';
                el.style.color = '';
                el.style.borderColor = '';
                el.style.boxShadow = '';
            });
        });
    }

    function setError(msg) {
        if (barEl)   barEl.classList.add('has-error');
        if (errorEl) errorEl.textContent = msg;
        if (countEl) { countEl.textContent = ''; countEl.className = 'psearch-count'; }
        resetCards();
    }

    function clearError() {
        if (barEl)   barEl.classList.remove('has-error');
        if (errorEl) errorEl.textContent = '';
    }

    // ── Empty query: show all ────────────────────────────────────────────
    if (!query) {
        clearError();
        if (countEl) { countEl.textContent = ''; countEl.className = 'psearch-count'; }
        resetCards();
        return;
    }

    if (!cards.length) return;

    // ── Range validation: valid values are 00, 0-36 ──────────────────────
    var isSpecial00 = (query === '00');
    var numVal      = parseInt(query, 10);

    var maxSearch = currentAppType === 'extendida' ? 75 : 36;
    if (!isSpecial00 && (isNaN(numVal) || numVal < 0 || numVal > maxSearch)) {
        setError('Rango v\u00e1lido: 00 \u00f3 0 \u2013 ' + maxSearch + '. Valor "' + query + '" fuera de rango.');
        return;
    }
    clearError();

    // ── Normalize query for matching ─────────────────────────────────────
    // Accept both "5" and "05" as matching the same number.
    // FIX: numVal > 0 (not just < 10) — avoids '0'+'0'='00' false match
    var qNorms = isSpecial00 ? ['00'] : [query, String(numVal), (numVal > 0 && numVal < 10) ? '0' + numVal : ''];
    qNorms = qNorms.filter(function(v, i, a) { return v !== '' && a.indexOf(v) === i; });

    function numMatches(n) {
        return qNorms.indexOf(n) !== -1;
    }

    // ── Filter cards ─────────────────────────────────────────────────────
    var matchCount = 0;
    cards.forEach(function(card) {
        var nums  = (card.dataset.numbers || '').split(',');
        var found = nums.some(numMatches);

        if (found) {
            matchCount++;
            card.style.opacity   = '1';
            card.style.outline   = '2.5px solid var(--accent)';
            card.style.transform = 'translateY(-2px)';
            card.querySelectorAll('.pattern-number').forEach(function(numEl) {
                var n = numEl.dataset.num || '';
                if (numMatches(n)) {
                    numEl.classList.add('pattern-num-highlight');
                    numEl.style.background  = '';
                    numEl.style.color       = '';
                    numEl.style.borderColor = '';
                    numEl.style.boxShadow   = '';
                } else {
                    numEl.classList.remove('pattern-num-highlight');
                }
            });
        } else {
            card.style.opacity   = '0.18';
            card.style.outline   = '';
            card.style.transform = '';
            card.querySelectorAll('.pattern-number').forEach(function(el) {
                el.classList.remove('pattern-num-highlight');
            });
        }
    });

    // ── Update count pill ────────────────────────────────────────────────
    if (countEl) {
        if (matchCount > 0) {
            countEl.textContent = matchCount + ' patr' + (matchCount === 1 ? 'on' : 'ones') + ' encontrado' + (matchCount === 1 ? '' : 's');
            countEl.style.color = 'var(--accent)';
        } else {
            countEl.textContent = 'Sin resultados';
            countEl.style.color = 'var(--danger)';
        }
    }
}


// --- Pattern Recommendation Logic ---

async function updatePatternRecommendations() {
    const container = document.getElementById('recommendations-list');
    const mainContainer = document.getElementById('pattern-recommendations');
    if (!container || !mainContainer) return;

    // Get today's numbers
    const dayData = db[currentDate] || {};
    const numbersToday = new Set(Object.values(dayData).filter(n => n && n.trim() !== '').map(n => NumberUtils.normalize(n)));

    // If no numbers yet, show placeholder
    if (numbersToday.size < 2) {
        mainContainer.style.display = 'block';
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">Ingresa al menos 2 números hoy para buscar patrones...</span>';
        return;
    }

    // Cache patterns if not already done (lazy load)
    if (!cachedPatterns) {
        try {
            // FIX #4: Pass currentDate explicitly so analysis window is anchored to selected date
            var patternDaysCache = currentAppType === 'extendida' ? 90 : 60;
    cachedPatterns = await findPatternsAsync(patternDaysCache, 5, currentDate);
        } catch (e) {
            console.error("Error fetching patterns for recommendation:", e);
            return;
        }
    }

    // Find partial matches
    const recommendations = [];

    cachedPatterns.forEach((pattern, index) => {
        // Check intersection with today's numbers
        const patternSet = new Set(pattern.numbers);
        const intersection = new Set([...patternSet].filter(x => numbersToday.has(x)));

        // Logic: specific "almost complete" patterns?
        // User asked: "identify patterns and recommend missing numbers"
        // Let's show if at least 2 numbers from the pattern are present today AND there are missing numbers.
        // Also simpler patterns (size 3) need 2 present. Size 4 needs 2 or 3. Size 5 needs 3 or 4.

        // Threshold: at least 50% match? or simple >= 2 matches?
        if (intersection.size >= 2 && intersection.size < patternSet.size) {
            // Correct variable:
            const missingCorrect = pattern.numbers.filter(x => !numbersToday.has(x));

            recommendations.push({
                id: index + 1,
                found: Array.from(intersection),
                missing: missingCorrect,
                numbers: pattern.numbers,        // full ordered pattern
                frequency: pattern.count,
                size: pattern.numbers.length
            });
        }
    });

    // Render
    if (recommendations.length === 0) {
        mainContainer.style.display = 'block';
        container.innerHTML = '<span style="color: var(--text-secondary); font-size: 0.9rem;">No se encontraron coincidencias de patrones aún.</span>';
        return;
    }

    const foundSet   = new Set();  // re-used per rec inside map
    mainContainer.style.display = 'block';
    container.innerHTML = recommendations.slice(0, 5).map(rec => {
        const missingSet = new Set(rec.missing);
        const chips = rec.numbers.map(n => {
            const animal = getAnimalName(n);
            const animalLabel = animal ? `<span style="display:block;font-size:0.65rem;color:inherit;opacity:0.75;line-height:1;margin-top:2px;">${animal}</span>` : '';
            if (missingSet.has(n)) {
                // Missing → bright green, pulsing border, bold
                return `<span style="
                    display:inline-flex;flex-direction:column;align-items:center;
                    background:rgba(34,197,94,0.18);
                    color:#4ade80;
                    border:2px solid #4ade80;
                    box-shadow:0 0 10px rgba(74,222,128,0.55);
                    padding:0.25rem 0.5rem;
                    border-radius:0.4rem;
                    font-weight:800;
                    font-size:1rem;
                    min-width:2.2rem;
                    text-align:center;
                    margin-right:0.3rem;
                    vertical-align:middle;
                ">${n}${animalLabel}</span>`;
            } else {
                // Found today → blue chip, dimmer
                return `<span style="
                    display:inline-flex;flex-direction:column;align-items:center;
                    background:rgba(59,130,246,0.12);
                    color:#93c5fd;
                    border:1px solid rgba(59,130,246,0.35);
                    padding:0.25rem 0.5rem;
                    border-radius:0.4rem;
                    font-weight:600;
                    font-size:1rem;
                    min-width:2.2rem;
                    text-align:center;
                    margin-right:0.3rem;
                    vertical-align:middle;
                ">${n}${animalLabel}</span>`;
            }
        }).join('');

        return `
            <div style="background:rgba(255,255,255,0.04);padding:0.6rem 0.75rem;border-radius:0.5rem;border:1px solid rgba(255,255,255,0.06);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                    <span style="color:var(--text-secondary);font-weight:600;font-size:0.8rem;">Patr&#243;n #${rec.id} &bull; ${rec.size} n&#250;ms</span>
                    <span style="background:rgba(59,130,246,0.2);color:#60a5fa;padding:0.1rem 0.5rem;border-radius:1rem;font-size:0.72rem;">${rec.frequency}&#215; visto</span>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:0.1rem;align-items:center;">
                    ${chips}
                </div>
                <div style="margin-top:0.4rem;font-size:0.75rem;color:var(--text-secondary);">
                    &#128994; = en juego hoy &nbsp;&nbsp; <span style="color:#4ade80;font-weight:700;">&#9650; = falta</span>
                </div>
            </div>
        `;
    }).join('');
}

function formatDateShort(dateStr) {
    const parts = dateStr.split('-');
    // dateStr is YYYY-MM-DD
    return `${parts[2]}/${parts[1]}`;
}


// --- Biblioteca de Animales ---


let bibliotecaRendered = null; // tracks which appType was last rendered

function renderBiblioteca() {
    const grid = document.getElementById('biblioteca-grid');
    if (!grid) return;

    // Re-render when app type changes (tradicional vs extendida have different maps)
    if (bibliotecaRendered !== currentAppType) {
        const activeMap = currentAppType === 'extendida' ? EXT_ANIMAL_MAP : ANIMAL_MAP;
        grid.innerHTML = activeMap.map(animal => `
            <div class="animal-card ${animal.num === '00' ? 'special-00' : ''}" data-num="${animal.num}" data-name="${animal.name.toLowerCase()}">
                <span class="animal-number">${animal.num}</span>
                <span class="animal-initial">${animal.name.charAt(0).toUpperCase()}</span>
                <span class="animal-name">${animal.name}</span>
            </div>
        `).join('');
        bibliotecaRendered = currentAppType;

        // Set up search (only once per render)
        const searchInput = document.getElementById('biblioteca-search');
        if (searchInput) {
            searchInput.value = '';
            // Remove old listener before adding new one
            searchInput.replaceWith(searchInput.cloneNode(true));
            document.getElementById('biblioteca-search').addEventListener('input', filterBiblioteca);
        }
    }
}

function filterBiblioteca() {
    const searchInput = document.getElementById('biblioteca-search');
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const cards = document.querySelectorAll('#biblioteca-grid .animal-card');
    const grid = document.getElementById('biblioteca-grid');

    // Remove old no-results message
    const existing = grid.querySelector('.biblioteca-no-results');
    if (existing) existing.remove();

    let visibleCount = 0;
    cards.forEach(card => {
        const num = card.dataset.num;
        const name = card.dataset.name;
        const matches = !query || num.includes(query) || name.includes(query);
        card.classList.toggle('hidden', !matches);
        if (matches) visibleCount++;
    });

    if (visibleCount === 0) {
        const msg = document.createElement('p');
        msg.className = 'biblioteca-no-results';
        msg.textContent = `No se encontraron resultados para "${searchInput.value.trim()}".`;
        grid.appendChild(msg);
    }
}

// Expose ANIMAL_MAP globally for use in other render functions



// ════════════════════════════════════════════════════════
// SIDEBAR — Menú de navegación deslizante
// ════════════════════════════════════════════════════════
function closeSidebar() {
    var sidebar   = document.getElementById('app-sidebar');
    var backdrop  = document.getElementById('sidebar-backdrop');
    var hamburger = document.getElementById('hamburger-btn');
    if (sidebar)   sidebar.classList.remove('is-open');
    if (backdrop)  backdrop.classList.remove('visible');
    if (hamburger) hamburger.classList.remove('is-open');
}

function openSidebar() {
    var sidebar   = document.getElementById('app-sidebar');
    var backdrop  = document.getElementById('sidebar-backdrop');
    var hamburger = document.getElementById('hamburger-btn');
    if (sidebar)   sidebar.classList.add('is-open');
    if (backdrop)  backdrop.classList.add('visible');
    if (hamburger) hamburger.classList.add('is-open');
}

function setupSidebar() {
    var hamburger = document.getElementById('hamburger-btn');
    var backdrop  = document.getElementById('sidebar-backdrop');
    var closeBtn  = document.getElementById('sidebar-close');

    if (hamburger) {
        hamburger.addEventListener('click', function(e) {
            e.stopPropagation();
            var sidebar = document.getElementById('app-sidebar');
            if (sidebar && sidebar.classList.contains('is-open')) {
                closeSidebar();
            } else {
                openSidebar();
            }
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebar);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeSidebar();
    });
}
// ============================================================
// MÓDULO: Calculadora de Pirámide de Fechas
// ============================================================

// Estado del módulo
let fechasActiveFilters = { horiz: true, horizRev: true, vert: true, diag: true };

// Convierte YYYY-MM-DD -> DDMMYYYY y ejecuta el cálculo
function autoRunFechas(isoDate) {
    var section = document.getElementById('fechas-section');
    if (!section || !section.dataset.fechasInit) return; // solo si ya fue inicializada
    var parts = isoDate.split('-');
    if (parts.length !== 3) return;
    var seed = parts[2] + parts[1] + parts[0]; // DD + MM + YYYY
    currentPyramid   = buildPyramid(seed);
    currentExtracted = extractNumbers(currentPyramid);
    renderPyramid(currentPyramid, seed);
    renderFechasResults(currentExtracted);
    // Update date display label
    var lbl = document.getElementById('fechas-date-display');
    if (lbl) lbl.textContent = DateUtils.formatDateVerbose(isoDate);
}



// --- Punto de entrada: se llama al activar la pestaña ---
function setupFechas() {
    var section = document.getElementById('fechas-section');
    if (!section) return;

    // Si ya fue inicializado, solo actualizar la fecha mostrada y recalcular
    if (section.dataset.fechasInit) {
        autoRunFechas(currentDate);
        return;
    }
    section.dataset.fechasInit = '1';

    section.innerHTML = `
        <div class="fechas-header">
            <h3>&#128336; C&#225;lculo de Fechas</h3>
            <p>La pir&#225;mide se actualiza autom&#225;ticamente al cambiar la fecha en el <strong>Registro Diario</strong>.</p>
        </div>

        <div class="fechas-controls">
            <span style="font-size:0.85rem;color:var(--text-secondary);font-weight:600;">Fecha:</span>
            <span id="fechas-date-display" style="
                font-weight:700;
                color:var(--text-primary);
                font-size:0.95rem;
                background:var(--bg-color);
                border:1px solid var(--border);
                border-radius:0.5rem;
                padding:0.4rem 1rem;
            "></span>
            <div class="fechas-filters">
                <span style="font-size:0.78rem;font-weight:700;color:var(--text-secondary);">Mostrar:</span>
                <button class="filter-chip active" data-filter="horiz"    style="color:#4ade80;border-color:#4ade80;">Horizontal</button>
                <button class="filter-chip active" data-filter="horizRev" style="color:#c084fc;border-color:#c084fc;">Espejo</button>
                <button class="filter-chip active" data-filter="vert"     style="color:#fbbf24;border-color:#fbbf24;">Vertical</button>
                <button class="filter-chip active" data-filter="diag"     style="color:#f87171;border-color:#f87171;">Diagonal</button>
            </div>
        </div>

        <div id="fechas-pyramid-wrapper" class="fechas-pyramid-wrapper">
            <div class="fechas-pyramid-title">Pir&#225;mide de Reducci&#243;n</div>
            <div id="pyramid-grid" class="pyramid-grid"></div>
        </div>

        <div id="fechas-results" class="fechas-results">
            <div class="fechas-results-title">N&#250;meros Extra&#237;dos</div>
            <div class="fechas-legend">
                <div class="legend-item"><span class="legend-dot horiz"></span>Horizontal</div>
                <div class="legend-item"><span class="legend-dot horiz-rev"></span>Espejo</div>
                <div class="legend-item"><span class="legend-dot vert"></span>Vertical</div>
                <div class="legend-item"><span class="legend-dot diag"></span>Diagonal</div>
                <div class="legend-item"><span class="legend-dot special"></span>00 Especial</div>
            </div>
            <div id="fechas-results-groups" class="fechas-results-groups"></div>
        </div>
    `;

    // Filter chip toggle
    document.querySelectorAll('#fechas-section .filter-chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
            var f = chip.dataset.filter;
            fechasActiveFilters[f] = !fechasActiveFilters[f];
            chip.classList.toggle('active', fechasActiveFilters[f]);
            renderFechasHighlights();
        });
    });

    // Run immediately with current date
    autoRunFechas(currentDate);
}

// --- Construir pirámide ---
function buildPyramid(seed) {
    var rows = [];
    var current = seed.split('').map(Number);
    rows.push(current.slice());
    while (current.length > 1) {
        var next = [];
        for (var i = 0; i < current.length - 1; i++) {
            next.push(Math.abs(current[i] - current[i+1]));
        }
        rows.push(next);
        current = next;
    }
    return rows;
}

// --- Extraer números válidos ---
function isValidLotteryNum(n) {
    return (n >= 0 && n <= 36);
}

function makeNumStr(a, b) {
    // Returns two-digit string "ab" as number if valid, or "00" if both zeros
    if (a === 0 && b === 0) return '00';
    var n = a * 10 + b;
    if (n >= 0 && n <= 36) return String(n);
    return null;
}

function extractNumbers(rows) {
    var results = {
        horiz:    [], // horizontal pairs (left→right)
        horizRev: [], // mirror pairs (right→left)
        vert:     [], // vertical (same column, adjacent rows)
        diag:     [], // diagonal (cross between rows)
        special00:[] // explicit 00s
    };

    // Deduplicate helper: store as "num|row|col" to avoid re-adding same cell pair
    var seen = { horiz:{}, horizRev:{}, vert:{}, diag:{}, special00:{} };

    function addResult(bucket, numStr, rowIdx, colIdx) {
        var key = numStr + '|' + rowIdx + '|' + colIdx;
        if (!seen[bucket][key]) {
            seen[bucket][key] = true;
            var animal = getAnimalName(numStr);
            results[bucket].push({ num: numStr, row: rowIdx, col: colIdx, animal: animal });
        }
    }

    for (var r = 0; r < rows.length; r++) {
        var row = rows[r];

        // HORIZONTAL pairs
        for (var c = 0; c < row.length - 1; c++) {
            var a = row[c], b = row[c+1];

            // Special 00
            if (a === 0 && b === 0) {
                addResult('special00', '00', r, c);
                addResult('horiz', '00', r, c);
            }

            // Left→Right: "ab"
            var ab = makeNumStr(a, b);
            if (ab && ab !== '00') addResult('horiz', ab, r, c);

            // Right→Left (mirror): "ba"
            var ba = makeNumStr(b, a);
            if (ba && ba !== '00') addResult('horizRev', ba, r, c);
        }

        // VERTICAL pairs (same col index, adjacent rows)
        if (r < rows.length - 1) {
            var nextRow = rows[r+1];
            // nextRow has one less element, starts 1 visual column to the right
            // In visual alignment: row[r][c] is at visual col r+c
            //                      row[r+1][c] is at visual col r+1+c  (one right)
            // Same visual column: row[r][c] and row[r+1][c-1]
            for (var c2 = 0; c2 < nextRow.length; c2++) {
                // row[r][c2+1] is directly above row[r+1][c2] in same visual column (shifted)
                // Top→Bottom vertical: row[r][c2+1] and row[r+1][c2]  (corrected visual alignment)
                var top = row[c2 + 1];      // visual col: r + c2 + 1
                var bot = nextRow[c2];       // visual col: r + 1 + c2  (same!)
                if (top === undefined) continue;

                if (top === 0 && bot === 0) addResult('special00', '00', r, c2);

                var tb = makeNumStr(top, bot);
                if (tb && tb !== '00') addResult('vert', tb, r, c2);

                var bt = makeNumStr(bot, top);
                if (bt && bt !== '00') addResult('vert', bt, r, c2);
            }
        }

        // DIAGONAL pairs
        if (r < rows.length - 1) {
            var nr = rows[r+1];
            for (var c3 = 0; c3 < row.length - 1; c3++) {
                // Diagonal right-down: row[r][c3] → row[r+1][c3]
                // (row[r+1][c3] is visually 1 step right-down from row[r][c3])
                if (c3 < nr.length) {
                    var d1 = makeNumStr(row[c3], nr[c3]);
                    if (d1 && d1 !== '00') addResult('diag', d1, r, c3);
                    if (row[c3] === 0 && nr[c3] === 0) addResult('special00', '00', r, c3);

                    var d2 = makeNumStr(nr[c3], row[c3]);
                    if (d2 && d2 !== '00') addResult('diag', d2, r, c3);
                }

                // Diagonal left-down: row[r][c3+1] → row[r+1][c3]  (same visual column, crossing)
                if (c3 < nr.length && c3+1 < row.length) {
                    var d3 = makeNumStr(row[c3+1], nr[c3]);
                    if (d3 && d3 !== '00') addResult('diag', d3, r, c3);

                    var d4 = makeNumStr(nr[c3], row[c3+1]);
                    if (d4 && d4 !== '00') addResult('diag', d4, r, c3);
                }
            }
        }
    }

    // Deduplicate by number string across buckets (keep first occurrence type)
    // (optional — we keep all to show all reading methods)
    return results;
}

// --- Estado global del cálculo actual ---
var currentPyramid = null;
var currentExtracted = null;

// --- Ejecutar cálculo ---


// --- Renderizar la pirámide visual ---
function renderPyramid(rows, seed) {
    var grid = document.getElementById('pyramid-grid');
    if (!grid) return;
    grid.innerHTML = '';

    var baseLen = rows[0].length; // 8

    rows.forEach(function(row, level) {
        var rowEl = document.createElement('div');
        rowEl.className = 'pyramid-row';
        rowEl.dataset.level = level;

        // Level tag
        var tag = document.createElement('span');
        tag.className = 'pyramid-level-tag';
        tag.textContent = level === 0 ? 'Base' : (level === rows.length - 1 ? 'Vtx' : 'N' + level);
        rowEl.appendChild(tag);

        // Spacers for indentation (right-align)
        for (var s = 0; s < level; s++) {
            var spacer = document.createElement('span');
            spacer.className = 'pyramid-spacer';
            rowEl.appendChild(spacer);
        }

        // Digit cells
        row.forEach(function(digit, colIdx) {
            var cell = document.createElement('span');
            cell.className = 'pyramid-cell';
            cell.dataset.row = level;
            cell.dataset.col = colIdx;
            if (level === 0)              cell.classList.add('level-0');
            if (level === rows.length-1)  cell.classList.add('vertex');
            cell.textContent = digit;
            rowEl.appendChild(cell);
        });

        grid.appendChild(rowEl);
    });

    // Apply highlights
    renderFechasHighlights();
}

// --- Aplicar highlights según filtros activos ---
function renderFechasHighlights() {
    if (!currentPyramid || !currentExtracted) return;

    // Reset all cells
    document.querySelectorAll('#pyramid-grid .pyramid-cell').forEach(function(c) {
        c.classList.remove('hl-horiz', 'hl-horiz-rev', 'hl-vert', 'hl-diag', 'hl-00');
    });

    function highlightPair(rowIdx, colIdx, cls) {
        var cell1 = document.querySelector('#pyramid-grid .pyramid-cell[data-row="'+rowIdx+'"][data-col="'+colIdx+'"]');
        var cell2 = document.querySelector('#pyramid-grid .pyramid-cell[data-row="'+rowIdx+'"][data-col="'+(colIdx+1)+'"]');
        if (cell1) cell1.classList.add(cls);
        if (cell2) cell2.classList.add(cls);
    }

    if (currentExtracted.special00.length > 0) {
        currentExtracted.special00.forEach(function(item) {
            highlightPair(item.row, item.col, 'hl-00');
        });
    }
    if (fechasActiveFilters.horiz) {
        currentExtracted.horiz.forEach(function(item) {
            if (item.num !== '00') highlightPair(item.row, item.col, 'hl-horiz');
        });
    }
    if (fechasActiveFilters.horizRev) {
        currentExtracted.horizRev.forEach(function(item) {
            highlightPair(item.row, item.col, 'hl-horiz-rev');
        });
    }
    if (fechasActiveFilters.vert) {
        currentExtracted.vert.forEach(function(item) {
            var c1 = document.querySelector('#pyramid-grid .pyramid-cell[data-row="'+item.row+'"][data-col="'+(item.col+1)+'"]');
            var c2 = document.querySelector('#pyramid-grid .pyramid-cell[data-row="'+(item.row+1)+'"][data-col="'+item.col+'"]');
            if (c1) c1.classList.add('hl-vert');
            if (c2) c2.classList.add('hl-vert');
        });
    }
    if (fechasActiveFilters.diag) {
        currentExtracted.diag.forEach(function(item) {
            var c1 = document.querySelector('#pyramid-grid .pyramid-cell[data-row="'+item.row+'"][data-col="'+item.col+'"]');
            var c2 = document.querySelector('#pyramid-grid .pyramid-cell[data-row="'+(item.row+1)+'"][data-col="'+item.col+'"]');
            if (c1) c1.classList.add('hl-diag');
            if (c2) c2.classList.add('hl-diag');
        });
    }
}

// --- Renderizar panel de resultados ---
function renderFechasResults(extracted) {
    var container = document.getElementById('fechas-results-groups');
    if (!container) return;
    container.innerHTML = '';

    var groups = [
        { key: 'special00', label: '00 Especial',  type: 'type-00'        },
        { key: 'horiz',     label: 'Horizontal',   type: 'type-horiz'     },
        { key: 'horizRev',  label: 'Espejo',       type: 'type-horiz-rev' },
        { key: 'vert',      label: 'Vertical',     type: 'type-vert'      },
        { key: 'diag',      label: 'Diagonal',     type: 'type-diag'      },
    ];

    groups.forEach(function(g) {
        var items = extracted[g.key];
        // Deduplicate by num within group
        var seen = {};
        var unique = items.filter(function(it) {
            if (seen[it.num]) return false;
            seen[it.num] = true;
            return true;
        });

        var groupEl = document.createElement('div');
        groupEl.className = 'result-group';

        var labelEl = document.createElement('div');
        labelEl.className = 'result-group-label';
        labelEl.textContent = g.label + ' (' + unique.length + ')';
        groupEl.appendChild(labelEl);

        var chipsEl = document.createElement('div');
        chipsEl.className = 'result-chips';

        if (unique.length === 0) {
            var empty = document.createElement('span');
            empty.className = 'fechas-no-results';
            empty.textContent = 'Ninguno encontrado';
            chipsEl.appendChild(empty);
        } else {
            unique.sort(function(a,b) {
                if (a.num === '00') return -1;
                if (b.num === '00') return 1;
                return parseInt(a.num,10) - parseInt(b.num,10);
            }).forEach(function(item) {
                var chip = document.createElement('div');
                chip.className = 'result-chip ' + g.type;
                chip.innerHTML = '<span class="chip-num">' + item.num + '</span>' +
                    (item.animal ? '<span class="chip-name">' + item.animal + '</span>' : '');
                chipsEl.appendChild(chip);
            });
        }

        groupEl.appendChild(chipsEl);
        container.appendChild(groupEl);
    });
}

// ============================================================
// MÓDULO: Twemoji — Compatibilidad de emojis en Windows 7+
// ============================================================
// Convierte emojis Unicode nativos en imágenes SVG de Twemoji
// para que se vean correctamente en cualquier sistema operativo.

var _twemojiObserver = null;

function initTwemoji() {
    if (typeof twemoji === 'undefined') {
        // Si el CDN no cargó (sin internet), no hacemos nada
        return;
    }

    var TWEMOJI_OPTS = {
        folder: 'svg',
        ext: '.svg',
        base: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/',
        attributes: function() {
            return { style: 'height:1em;width:1em;vertical-align:-0.15em;display:inline-block;' };
        }
    };

    // Parsear el contenido existente en el body
    twemoji.parse(document.body, TWEMOJI_OPTS);

    // MutationObserver optimizado: debounced + solo secciones activas
    // No vigila todo el body para evitar lag en PCs de bajos recursos.
    if (_twemojiObserver) _twemojiObserver.disconnect();

    var _twTimer = null;
    _twemojiObserver = new MutationObserver(function(mutations) {
        // Debounce: espera 300ms antes de procesar para no disparar en cada keystroke
        clearTimeout(_twTimer);
        _twTimer = setTimeout(function() {
            for (var i = 0; i < mutations.length; i++) {
                var nodes = mutations[i].addedNodes;
                for (var j = 0; j < nodes.length; j++) {
                    var node = nodes[j];
                    // Solo elementos (no texto/comentarios) y solo secciones de contenido
                    if (node.nodeType === 1 && !node.classList.contains('emoji')) {
                        twemoji.parse(node, TWEMOJI_OPTS);
                    }
                }
            }
        }, 300);
    });

    // Observar solo el contenedor principal, con subtree limitado
    var _mainTarget = document.querySelector('main') || document.body;
    _twemojiObserver.observe(_mainTarget, {
        childList: true,
        subtree: true
    });
}


// ═══════════════════════════════════════════════════════════




// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// MÓDULO: Ganancias y Pérdidas — v2 (3 sub-tabs)
// ═══════════════════════════════════════════════════════════

var _ganData   = {};
var _ganHour   = '';
var _ganSubTab = 'ticket';   // 'ticket' | 'estadisticas' | 'historial'
var _GAN_HOURS = [8,9,10,11,12,13,14,15,16,17,18,19];

// ── Persistencia ─────────────────────────────────────────
function _ganKey()  { return 'ganancias_' + currentMode + '_' + currentDate; }
function _ganLoad() { try { var r=localStorage.getItem(_ganKey()); _ganData=r?JSON.parse(r):{} } catch(e){_ganData={}} }
function _ganSave() {
    // Si no hay apuestas, eliminar la clave en vez de guardar {} vacio
    if (!Object.keys(_ganData).length) {
        localStorage.removeItem(_ganKey());
    } else {
        localStorage.setItem(_ganKey(), JSON.stringify(_ganData));
    }
}
function _ganMult() { return currentAppType === 'extendida' ? 60 : 30; }

// ── Helpers ───────────────────────────────────────────────
function _ganGetAmount(h,num){ return (_ganData[h]&&_ganData[h][num])||''; }

function _ganSetAmount(h,num,amount) {
    if (!h) return;
    if (!_ganData[h]) _ganData[h]={};
    var v = amount===''||amount==='0'||isNaN(parseFloat(amount));
    if (v) { delete _ganData[h][num]; if(!Object.keys(_ganData[h]).length) delete _ganData[h]; }
    else   { _ganData[h][num]=amount; }
    _ganSave();
    var cell=document.querySelector('.ganancias-cell[data-num="'+num+'"]');
    if(cell) cell.classList.toggle('has-bet',!v);
    _ganUpdateCounter();
    if(typeof updateGlobalNeto==='function') updateGlobalNeto();
}

function _ganFmt(v){ return v===0?'0':Math.abs(v).toLocaleString('es-VE',{minimumFractionDigits:0,maximumFractionDigits:2}); }
function _ganFmtHour(h){ var n=parseInt(h); return n<12?n+' AM':n===12?'12 PM':(n-12)+' PM'; }



// ── Cálculo de totales (día actual, basado en db) ─────────
function _ganCalcTotals() {
    var bet=0,win=0;
    var dr=((typeof db!=='undefined'?db:{})[currentDate])||{};
    Object.keys(_ganData).forEach(function(h){
        var hb=_ganData[h], ln=String(dr[h]||'');
        Object.keys(hb).forEach(function(num){
            var a=parseFloat(hb[num])||0; bet+=a;
            if(ln&&ln===num) win+=a*_ganMult();
        });
    });
    return {bet:bet,win:win,net:win-bet};
}

// ── Por hora (para gráfica y tabla) ──────────────────────
function _ganGetHourStats() {
    var dr=((typeof db!=='undefined'?db:{})[currentDate])||{};
    return _GAN_HOURS.map(function(h){
        var hs=String(h), hb=_ganData[hs]||{}, ln=String(dr[hs]||'');
        var bet=0,win=0;
        Object.keys(hb).forEach(function(num){
            var a=parseFloat(hb[num])||0; bet+=a;
            if(ln&&ln===num) win+=a*_ganMult();
        });
        return {hour:hs,label:_ganFmtHour(hs),bet:bet,win:win,net:win-bet,lottNum:ln,bets:hb};
    });
}

function _ganUpdateCounter() {
    var t=_ganCalcTotals();
    var bEl=document.getElementById('gc-apostado'),wEl=document.getElementById('gc-ganado'),nEl=document.getElementById('gc-neto');
    if(bEl) bEl.textContent=t.bet===0?'0':'-'+_ganFmt(t.bet);
    if(wEl) wEl.textContent=t.win===0?'0':'+'+_ganFmt(t.win);
    if(nEl){
        // FIX #1: Removed dead-code line that called _ganFmt() (string) * -1 = NaN
        nEl.textContent=(t.net===0?'0':(t.net>0?'+':'-')+_ganFmt(t.net));
        nEl.className='gc-value gc-neto '+(t.net>0?'pos':t.net<0?'neg':'zero');
    }
    var hl=document.getElementById('gc-hour-label');
    if(hl) hl.textContent=_ganHour?_ganFmtHour(_ganHour):'--';
}

function _ganRefreshInputs() {
    document.querySelectorAll('.gan-amount-input').forEach(function(inp){
        var num=inp.dataset.num, amount=_ganHour?_ganGetAmount(_ganHour,num):'';
        inp.value=amount; inp.disabled=!_ganHour;
        inp.classList.toggle('filled',amount!=='');
        var c=inp.closest('.ganancias-cell'); if(c) c.classList.toggle('has-bet',amount!=='');
    });
    var w=document.getElementById('gan-warning'); if(w) w.classList.toggle('hidden',!!_ganHour);
    _ganUpdateCounter();
}

// ── SUB-TAB: TICKET ──────────────────────────────────────
function _ganBuildHourDropdown() {
    var s='<div class="gan-hour-bar"><span class="gan-hour-label">&#128336; Hora del sorteo</span>';
    s+='<div class="gan-hour-dropdown" id="gan-hour-dropdown">';
    s+='<button type="button" class="gan-hour-btn" id="gan-hour-btn">';
    s+='<span id="gan-hour-btn-label">'+(_ganHour?_ganFmtHour(_ganHour):'-- Selecciona la hora --')+'</span>';
    s+='<span class="gan-hour-btn-arrow">&#9660;</span></button>';
    s+='<div class="gan-hour-options" id="gan-hour-options">';
    s+='<div class="gan-hour-option placeholder" data-value="">-- Selecciona la hora --</div>';
    _GAN_HOURS.forEach(function(h){
        var a=String(h)===_ganHour?' active':'';
        s+='<div class="gan-hour-option'+a+'" data-value="'+h+'">'+_ganFmtHour(String(h))+'</div>';
    });
    s+='</div></div>';
    s+='<div class="gan-warning'+(_ganHour?' hidden':'')+'" id="gan-warning">&#9888;&#65039; Selecciona una hora antes de registrar apuestas</div>';
    s+='</div>';
    return s;
}

function _ganBuildCell(num) {
    var animal=getAnimalName(num)||'', amount=_ganHour?_ganGetAmount(_ganHour,num):'';
    var dis=_ganHour?'':' disabled', fil=amount?' filled':'', hb=amount?' has-bet':'';
    return '<div class="ganancias-cell'+hb+'" data-num="'+num+'">'
        +'<span class="gan-num">'+num+'</span>'
        +'<span class="gan-animal">'+animal+'</span>'
        +'<input class="gan-amount-input'+fil+'" type="number" min="0" step="any" placeholder="Bs." data-num="'+num+'" value="'+amount+'"'+dis+'>'
        +'</div>';
}

function _ganBuildTicket() {
    var t=_ganCalcTotals();
    var dateFmt=DateUtils.formatDateVerbose(currentDate);
    var nc=t.net>0?'pos':t.net<0?'neg':'zero';
    var mult=_ganMult();
    var isExt = currentAppType === 'extendida';
    var maxNum = isExt ? 75 : 36;
    var gridClass = isExt ? 'ganancias-grid ganancias-grid--wide' : 'ganancias-grid';

    var s=_ganBuildHourDropdown();
    s+='<div class="ganancias-header">';
    s+='<div class="ganancias-date">&#128200; '+dateFmt+'</div>';
    s+='<div class="ganancias-counter">';
    s+='<div class="gc-block"><span class="gc-label">Apostado</span><span id="gc-apostado" class="gc-value '+(t.bet>0?'neg':'zero')+'">'+(t.bet?'-'+_ganFmt(t.bet):'0')+'</span></div>';
    s+='<div class="gc-divider"></div>';
    s+='<div class="gc-block"><span class="gc-label">Ganado (\u00d7'+mult+')</span><span id="gc-ganado" class="gc-value '+(t.win>0?'pos':'zero')+'">'+(t.win?'+'+_ganFmt(t.win):'0')+'</span></div>';
    s+='<div class="gc-divider"></div>';
    s+='<div class="gc-block"><span class="gc-label">Neto del D\u00eda</span><span id="gc-neto" class="gc-value gc-neto '+nc+'">'+(t.net===0?'0':(t.net>0?'+':'-')+_ganFmt(t.net))+'</span></div>';
    s+='</div></div>';
    s+='<div class="'+gridClass+'"><div class="ganancias-top-pair">';
    s+=_ganBuildCell('0'); s+=_ganBuildCell('00');
    s+='</div>';
    for(var n=1;n<=maxNum;n++) s+=_ganBuildCell(String(n));
    s+='</div>';
    return s;
}

// ── SUB-TAB: ESTADÍSTICAS ─────────────────────────────────
function _ganBuildEstadisticas() {
    var t=_ganCalcTotals(), hs=_ganGetHourStats();
    var dateFmt=DateUtils.formatDateVerbose(currentDate);
    var nc=t.net>0?'#4ade80':t.net<0?'#f87171':'var(--text-secondary)';
    var s='';

    // Cards resumen
    s+='<div style="margin-bottom:0.75rem;font-size:0.8rem;color:var(--text-secondary);font-weight:600;">&#128200; '+dateFmt+'</div>';
    s+='<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-bottom:1.1rem;">';
    s+='<div class="gan-stat-card red"><div class="gan-stat-label">Apostado</div><div class="gan-stat-val" style="color:#f87171">'+(t.bet?'-'+_ganFmt(t.bet):'0')+'</div></div>';
    s+='<div class="gan-stat-card green"><div class="gan-stat-label">Ganado</div><div class="gan-stat-val" style="color:#4ade80">'+(t.win?'+'+_ganFmt(t.win):'0')+'</div></div>';
    s+='<div class="gan-stat-card" style="background:rgba(139,92,246,0.08);border-color:rgba(139,92,246,0.25)"><div class="gan-stat-label" style="color:#c4b5fd">Neto</div><div class="gan-stat-val" style="color:'+nc+'">'+(t.net===0?'0':(t.net>0?'+':'-')+_ganFmt(t.net))+'</div></div>';
    s+='</div>';

    // Gráfica por hora
    var maxAbs=0;
    hs.forEach(function(r){ if(Math.abs(r.net)>maxAbs) maxAbs=Math.abs(r.net); if(r.bet>maxAbs) maxAbs=r.bet; });
    s+='<div class="gan-chart-wrap"><div class="gan-chart-title">&#128202; Resultado por Hora</div>';
    hs.forEach(function(r){
        var hasBet=r.bet>0, col=r.net>=0&&hasBet?'#4ade80':'#f87171';
        var barPct=maxAbs>0?Math.round(Math.abs(r.net)/maxAbs*100):0;
        var betPct=maxAbs>0?Math.round(r.bet/maxAbs*100):0;
        var pct=hasBet?(r.net===0?betPct:barPct):0;
        var valTxt=hasBet?(r.net===0?'-'+_ganFmt(r.bet):(r.net>0?'+':'-')+_ganFmt(r.net)):'–';
        s+='<div class="gan-chart-row">';
        s+='<span class="gan-chart-lbl">'+r.label+'</span>';
        s+='<div class="gan-chart-bar-wrap">';
        s+='<div class="gan-chart-bar" style="width:'+pct+'%;background:'+col+';opacity:'+(hasBet?1:0.15)+';"></div>';
        s+='</div>';
        s+='<span class="gan-chart-val" style="color:'+(hasBet?col:'var(--text-secondary)')+'">'+valTxt+'</span>';
        s+='</div>';
    });
    s+='</div>';

    // Tabla detalle del día
    s+='<div class="gan-chart-title" style="margin-top:1rem;margin-bottom:0.5rem;">&#128203; Registro del D\u00eda</div>';
    var hasAny=false;
    hs.forEach(function(r){
        if(!r.bet) return;
        hasAny=true;
        Object.keys(r.bets).forEach(function(num){
            var amount=parseFloat(r.bets[num])||0;
            if(!amount) return;
            var ganó=r.lottNum&&r.lottNum===num;
            var res=r.lottNum?(ganó?'<span style="color:#4ade80;font-weight:700;">&#9989; GAN\u00d3</span>':'<span style="color:#f87171;">&#10060; No sali\u00f3</span>'):'<span style="color:var(--text-secondary);">&#8212;</span>';
            var ganVal=ganó?'+'+_ganFmt(amount*_ganMult()):'–';
            s+='<div class="gan-detail-row">';
            s+='<span class="gan-dr-hour">'+r.label+'</span>';
            s+='<span class="gan-dr-num">'+num+'</span>';
            s+='<span class="gan-dr-animal">'+( getAnimalName(num)||'')+'</span>';
            s+='<span class="gan-dr-bet" style="color:#f87171;">-'+_ganFmt(amount)+'</span>';
            s+='<span class="gan-dr-res">'+res+'</span>';
            s+='<span class="gan-dr-gain" style="color:#4ade80;">'+ganVal+'</span>';
            s+='</div>';
        });
    });
    if(!hasAny) s+='<p style="color:var(--text-secondary);text-align:center;padding:1rem;font-size:0.85rem;">Sin apuestas registradas para esta fecha.</p>';
    return s;
}

// ── SUB-TAB: HISTORIAL ────────────────────────────────────
function _ganBuildHistorial() {
    var prefix='ganancias_'+currentMode+'_';
    // FIX #5: Use Object.keys() instead of index-based iteration for stable key enumeration
    var dates = Object.keys(localStorage)
        .filter(function(key) { return key && key.indexOf(prefix) === 0; })
        .map(function(key) { return key.replace(prefix, ''); })
        .filter(function(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); });
    dates.sort().reverse();

    var lottData={};
    try{ var rL=localStorage.getItem('lottery_data_'+currentMode); lottData=rL?JSON.parse(rL):{}; }catch(e){}

    var s='<div class="gan-hist-controls">';
    s+='<button class="secondary-btn" id="gan-export-btn">&#128190; Exportar</button>';
    s+='<button class="secondary-btn" id="gan-import-btn">&#128194; Importar</button>';
    s+='<input type="file" id="gan-import-file" style="display:none" accept=".json">';
    s+='</div>';

    if(!dates.length){
        s+='<p style="color:var(--text-secondary);text-align:center;padding:2rem;font-size:0.88rem;">Sin historial registrado para el modo actual.</p>';
        return s;
    }

    s+='<div class="table-wrapper"><table class="gan-hist-table">';
    s+='<thead><tr><th style="text-align:left">Fecha</th><th>Apostado</th><th>Ganado</th><th>Neto</th></tr></thead><tbody>';
    dates.forEach(function(date){
        var gd={};
        try{ var rg=localStorage.getItem(prefix+date); gd=rg?JSON.parse(rg):{}; }catch(e){}

        // Calcular totales para esta fecha
        var dr=lottData[date]||{};
        var bet=0,win=0;
        Object.keys(gd).forEach(function(h){
            var hb=gd[h], ln=String(dr[h]||'');
            Object.keys(hb).forEach(function(num){
                var a=parseFloat(hb[num])||0; bet+=a;
                if(ln&&ln===num) win+=a*_ganMult();
            });
        });

        // Ignorar fechas sin apuestas reales (entradas vacias o residuales)
        if (bet === 0 && win === 0) {
            // Limpiar la clave residual del localStorage
            try { localStorage.removeItem(prefix+date); } catch(e){}
            return;
        }

        var net=win-bet;
        var nc=net>0?'#4ade80':net<0?'#f87171':'var(--text-secondary)';
        var ntxt=net===0?'0':(net>0?'+':'-')+_ganFmt(net);
        var isToday=date===currentDate;
        s+='<tr'+(isToday?' class="gan-hist-today"':'')+'>';
        s+='<td style="font-weight:600">'+DateUtils.formatDateVerbose(date)+'</td>';
        s+='<td style="text-align:right;color:#f87171">'+(bet?'-'+_ganFmt(bet):'0')+'</td>';
        s+='<td style="text-align:right;color:#4ade80">'+(win?'+'+_ganFmt(win):'0')+'</td>';
        s+='<td style="text-align:right;color:'+nc+';font-weight:800">'+ntxt+'</td>';
        s+='</tr>';
    });
    s+='</tbody></table></div>';
    return s;
}

// ── RENDER PRINCIPAL ──────────────────────────────────────
function renderGanancias() {
    _ganLoad();

    // AUTO-RECOMENDACIÓN: si no hay hora seleccionada, sugerir el próximo sorteo disponible
    if (!_ganHour) {
        var nowH = new Date().getHours();
        var recommended = '';
        // Primera: busca la hora actual o siguiente sin apuestas
        for (var i = 0; i < _GAN_HOURS.length; i++) {
            var h = String(_GAN_HOURS[i]);
            if (_GAN_HOURS[i] >= nowH && (!_ganData[h] || Object.keys(_ganData[h]).length === 0)) {
                recommended = h;
                break;
            }
        }
        // Si no hay horas futuras sin apuestas, tomar la primera del día sin apuestas
        if (!recommended) {
            for (var j = 0; j < _GAN_HOURS.length; j++) {
                var hj = String(_GAN_HOURS[j]);
                if (!_ganData[hj] || Object.keys(_ganData[hj]).length === 0) {
                    recommended = hj;
                    break;
                }
            }
        }
        if (recommended) _ganHour = recommended;
    }

    var inner=document.getElementById('ganancias-inner');
    if(!inner) return;

    // Sub-tab bar
    var tabs=[
        {id:'ticket',    icon:'&#127915;', label:'Ticket'},
        {id:'estadisticas',icon:'&#128202;',label:'Estad\u00edsticas'},
        {id:'historial', icon:'&#128203;', label:'Historial'}
    ];
    var html='<div class="gan-subtabs">';
    tabs.forEach(function(t){
        html+='<button class="gan-subtab-btn'+(_ganSubTab===t.id?' active':'')+'" data-subtab="'+t.id+'">'+t.icon+' '+t.label+'</button>';
    });
    html+='</div>';

    // Content
    if(_ganSubTab==='ticket')         html+=_ganBuildTicket();
    else if(_ganSubTab==='estadisticas') html+=_ganBuildEstadisticas();
    else                               html+=_ganBuildHistorial();

    inner.innerHTML=html;

    // Sub-tab click
    inner.querySelectorAll('.gan-subtab-btn').forEach(function(btn){
        btn.addEventListener('click',function(){
            _ganSubTab=this.dataset.subtab;
            renderGanancias();
        });
    });

    if(_ganSubTab==='ticket')       _ganSetupTicketListeners(inner);
    else if(_ganSubTab==='historial') _ganSetupHistorialListeners(inner);
}

function _ganSetupTicketListeners(inner) {
    var hBtn=document.getElementById('gan-hour-btn'), hOpts=document.getElementById('gan-hour-options');
    if(hBtn) hBtn.addEventListener('click',function(e){ e.stopPropagation(); hBtn.classList.toggle('open'); hOpts.classList.toggle('open'); });
    if(hOpts) hOpts.querySelectorAll('.gan-hour-option').forEach(function(opt){
        opt.addEventListener('click',function(){
            _ganHour=this.dataset.value;
            var lbl=document.getElementById('gan-hour-btn-label');
            if(lbl) lbl.textContent=_ganHour?_ganFmtHour(_ganHour):'-- Selecciona la hora --';
            hOpts.querySelectorAll('.gan-hour-option').forEach(function(o){o.classList.remove('active');});
            if(_ganHour) this.classList.add('active');
            hBtn.classList.remove('open'); hOpts.classList.remove('open');
            _ganRefreshInputs();
        });
    });
    document.addEventListener('click',function _go(e){
        var dd=document.getElementById('gan-hour-dropdown');
        if(!dd){document.removeEventListener('click',_go);return;}
        if(!dd.contains(e.target)){
            var b=document.getElementById('gan-hour-btn'),o=document.getElementById('gan-hour-options');
            if(b)b.classList.remove('open'); if(o)o.classList.remove('open');
        }
    });
    inner.querySelectorAll('.gan-amount-input').forEach(function(inp){
        inp.addEventListener('change',function(){
            if(!_ganHour) return;
            _ganSetAmount(_ganHour,this.dataset.num,this.value.trim());
            this.classList.toggle('filled',!!parseFloat(this.value));
        });
        inp.addEventListener('input',function(){ this.classList.toggle('filled',!!parseFloat(this.value)); });
    });
}

function _ganSetupHistorialListeners(inner) {
    var expBtn=document.getElementById('gan-export-btn');
    var impBtn=document.getElementById('gan-import-btn');
    var impFile=document.getElementById('gan-import-file');

    if(expBtn) expBtn.addEventListener('click',function(){
        var prefix='ganancias_'+currentMode+'_', all={};
        Object.keys(localStorage).forEach(function(key) {
            if(key && key.indexOf(prefix)===0){ 
                var d = key.replace(prefix,''); 
                try{ all[d] = JSON.parse(localStorage.getItem(key)); }catch(e){} 
            }
        });
        var blob=new Blob([JSON.stringify(all,null,2)],{type:'application/json'});
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a'); a.href=url;
        a.download='ganancias_'+currentMode.toUpperCase()+'_'+currentDate+'.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    });

    if(impBtn) impBtn.addEventListener('click',function(){ if(impFile) impFile.click(); });

    if(impFile) impFile.addEventListener('change',function(){
        var file=this.files[0]; if(!file) return;
        var reader=new FileReader();
        reader.onload=function(e){
            try{
                var data=JSON.parse(e.target.result);
                UI.confirm('\u00bfImportar '+Object.keys(data).length+' d\u00eda(s) de apuestas? Esto sobreescribir\u00e1 los datos existentes.', function(){
                    var prefix='ganancias_'+currentMode+'_';
                    Object.keys(data).forEach(function(d){ localStorage.setItem(prefix+d,JSON.stringify(data[d])); });
                    UI.showToast('\u2705 Importado correctamente.', 'success');
                    renderGanancias();
                    if(typeof updateGlobalNeto==='function') updateGlobalNeto();
                }, null, '\ud83d\udcca Importar Apuestas');
            } catch(err){ UI.showToast('Error al leer el archivo JSON.', 'error'); }
        };
        reader.readAsText(file); this.value='';
    });
}
// NETO GLOBAL — Suma los 3 modos para la fecha activa
// Se muestra siempre visible en el header.
// ═══════════════════════════════════════════════════════════

function calcGlobalNeto() {
    // Sum ALL modes from BOTH app types (tradicional + extendida combined)
    var totalNet = 0;

    var allTypeEntries = [
        { modes: APP_CONFIGS.tradicional.modes, mult: 30 },
        { modes: APP_CONFIGS.extendida.modes,   mult: 60 }
    ];

    allTypeEntries.forEach(function(entry) {
        entry.modes.forEach(function(mode) {
            // Apuestas del usuario para este modo/fecha
            var ganKey  = 'ganancias_' + mode + '_' + currentDate;
            var ganData = {};
            try {
                var raw = localStorage.getItem(ganKey);
                ganData = raw ? JSON.parse(raw) : {};
            } catch(e) {}

            // Resultados reales del sorteo para este modo/fecha
            var lotteryData = {};
            try {
                var rawL = localStorage.getItem('lottery_data_' + mode);
                lotteryData = rawL ? JSON.parse(rawL) : {};
            } catch(e) {}

            var dayResults = lotteryData[currentDate] || {};

            // Calcular neto para este modo
            var hours = Object.keys(ganData);
            for (var k = 0; k < hours.length; k++) {
                var h        = hours[k];
                var hourBets = ganData[h];
                var lottNum  = String(dayResults[h] || '');
                var nums = Object.keys(hourBets);
                for (var n = 0; n < nums.length; n++) {
                    var num    = nums[n];
                    var amount = parseFloat(hourBets[num]) || 0;
                    totalNet  -= amount;
                    if (lottNum !== '' && lottNum === num) {
                        totalNet += amount * entry.mult;
                    }
                }
            }
        });
    });

    return totalNet;
}

function _globalFmt(v) {
    if (v === 0) return '0';
    return Math.abs(v).toLocaleString('es-VE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function updateGlobalNeto() {
    var badge = document.getElementById('global-neto-badge');
    if (!badge) return;
    var net = calcGlobalNeto();
    var cls = net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero';
    var txt = net === 0 ? 'Neto: 0'
        : net > 0 ? 'Neto: +' + _globalFmt(net)
        : 'Neto: -' + _globalFmt(net);
    badge.textContent = txt;
    badge.className   = 'global-neto-badge ' + cls;
}
