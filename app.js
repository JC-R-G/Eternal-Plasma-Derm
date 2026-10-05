/* ============================================================
   ETERNAL PLASMA DERM - LÓGICA DE TURNOS Y MODO PROFESIONAL
   ============================================================ */

const SUPABASE_URL = "https://izmumxhupaybploxfbft.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6bXVteGh1cGF5YnBsb3hmYmZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzE3ODMsImV4cCI6MjEwNjYwNzc4M30.sHPpcPs1J6OFjnosRLynWQe3sBZlvqS26t-x3Dn5bVM";
const ADMIN_PASSWORD = "eternaladmin2026";

// DATOS DE MERCADO PAGO Y CONTACTO
const MP_ALIAS = "patogil.mp";
const SENA_VALOR = "$20.000";
const WHATSAPP_NUMERO = "5492645447043";

// Esquema de horarios según el día
const HORARIOS_SEMANA = ["16:00", "17:15", "18:30", "19:45"];
const HORARIOS_SABADO = ["09:30", "11:00", "12:30", "15:00", "16:30", "18:00", "19:30"];

// Encabezados REST estándar y completos para Supabase PostgREST
const getHeaders = (extraHeaders = {}) => ({
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
  ...extraHeaders
});

// Estado de sesión Admin
let isAdminLogged = sessionStorage.getItem("eternal_admin_auth") === "true";

// Helper: Determina si una fecha está permitida y a qué clínica corresponde
function getClinicScheduleForDate(dateObj) {
  const dayOfWeek = dateObj.getDay(); // 0: Dom, 1: Lun, 2: Mar, 3: Mié, 4: Jue, 5: Vie, 6: Sáb
  const dayOfMonth = dateObj.getDate();
  const occurrence = Math.ceil(dayOfMonth / 7);

  // Lunes: Capital
  if (dayOfWeek === 1) {
    return {
      allowed: true,
      clinic: "Capital - Clínica RENACER"
    };
  }

  // Miércoles: Pocito
  if (dayOfWeek === 3) {
    return {
      allowed: true,
      clinic: "Pocito - Instituto de la Salud"
    };
  }

  // Jueves: Solo el 2º jueves del mes en Jáchal
  if (dayOfWeek === 4) {
    if (occurrence === 2) {
      return {
        allowed: true,
        clinic: "Jáchal - Clínica Eli Pa Ce"
      };
    }
    return { allowed: false, clinic: null };
  }

  // Viernes: 1º viernes en Valle Fértil, 2º viernes en Rodeo
  if (dayOfWeek === 5) {
    if (occurrence === 1) {
      return {
        allowed: true,
        clinic: "Valle Fértil - S.I.M.A"
      };
    } else if (occurrence === 2) {
      return {
        allowed: true,
        clinic: "Rodeo - Clínica Santo Domingo"
      };
    }
    return { allowed: false, clinic: null };
  }

  // Sábados: Valle Fértil
  if (dayOfWeek === 6) {
    return {
      allowed: true,
      clinic: "Valle Fértil - S.I.M.A"
    };
  }

  // Martes y Domingos cerrados
  return { allowed: false, clinic: null };
}

// Cliente REST con headers completos y parseo seguro
const db = {
  async getBookedRecords(dateStr) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?appointment_date=eq.${dateStr}&select=*`, {
      method: "GET",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async insertAppointment(payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: getHeaders({
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      }),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }
    return await res.json();
  },

  async getAllAppointments() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?select=*&order=appointment_date.asc,appointment_time.asc`, {
      method: "GET",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async updateStatus(id, newStatus) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: getHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async deleteAppointment(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "DELETE",
      headers: getHeaders()
    });
    if (!res.ok) throw new Error(await res.text());
  }
};

let currentDate = new Date();
let selectedDateString = null;
let selectedTimeSlot = null;
let currentAssignedClinic = null;

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

function getFormattedDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const monthYearLabel = document.getElementById("currentMonthYear");
  const calendarDaysGrid = document.getElementById("calendarDays");
  const prevMonthBtn = document.getElementById("prevMonthBtn");
  const nextMonthBtn = document.getElementById("nextMonthBtn");
  const selectedDateLabel = document.getElementById("selectedDateLabel");
  const slotsContainer = document.getElementById("slotsContainer");
  const bookingForm = document.getElementById("bookingForm");
  const bookingSuccessMessage = document.getElementById("bookingSuccessMessage");
  const clientClinicSelect = document.getElementById("clientClinic");

  // Elementos Admin
  const adminTopBar = document.getElementById("adminTopBar");
  const lockIconDefault = document.getElementById("lockIconDefault");
  const lockIconLogged = document.getElementById("lockIconLogged");
  const adminDayControls = document.getElementById("adminDayControls");
  const adminToggleDayBlockBtn = document.getElementById("adminToggleDayBlockBtn");
  const adminHintSlot = document.getElementById("adminHintSlot");
  const openAdminDashboardBtn = document.getElementById("openAdminDashboardBtn");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");

  const adminModal = document.getElementById("adminModal");
  const openAdminBtn = document.getElementById("openAdminBtn");
  const closeAdminBtn = document.getElementById("closeAdminBtn");
  const adminLoginView = document.getElementById("adminLoginView");
  const adminDashboardView = document.getElementById("adminDashboardView");
  const adminPasswordInput = document.getElementById("adminPasswordInput");
  const toggleAdminPassBtn = document.getElementById("toggleAdminPassBtn");
  const eyeIcon = document.getElementById("eyeIcon");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminLoginError = document.getElementById("adminLoginError");
  const adminAppointmentsList = document.getElementById("adminAppointmentsList");
  const adminStatusFilter = document.getElementById("adminStatusFilter");
  const refreshAdminBtn = document.getElementById("refreshAdminBtn");

  function syncAdminUI() {
    if (isAdminLogged) {
      if (adminTopBar) adminTopBar.classList.remove("hidden");
      if (lockIconDefault) lockIconDefault.classList.add("hidden");
      if (lockIconLogged) lockIconLogged.classList.remove("hidden");
      if (adminHintSlot) adminHintSlot.classList.remove("hidden");
      if (adminDayControls && selectedDateString) adminDayControls.classList.remove("hidden");
    } else {
      if (adminTopBar) adminTopBar.classList.add("hidden");
      if (lockIconDefault) lockIconDefault.classList.remove("hidden");
      if (lockIconLogged) lockIconLogged.classList.add("hidden");
      if (adminHintSlot) adminHintSlot.classList.add("hidden");
      if (adminDayControls) adminDayControls.classList.add("hidden");
    }
  }

  if (toggleAdminPassBtn && adminPasswordInput) {
    toggleAdminPassBtn.addEventListener("click", () => {
      const isPassword = adminPasswordInput.type === "password";
      adminPasswordInput.type = isPassword ? "text" : "password";

      if (eyeIcon) {
        if (isPassword) {
          eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
          `;
        } else {
          eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          `;
        }
      }
    });
  }

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (monthYearLabel) monthYearLabel.textContent = `${MONTH_NAMES[month]} ${year}`;
    if (!calendarDaysGrid) return;
    calendarDaysGrid.innerHTML = "";

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const todayStr = getFormattedDate(new Date());

    for (let i = 0; i < firstDayIndex; i++) {
      const empty = document.createElement("div");
      empty.className = "h-10";
      calendarDaysGrid.appendChild(empty);
    }

    for (let day = 1; day <= totalDays; day++) {
      const dayBtn = document.createElement("button");
      const dateObj = new Date(year, month, day);
      const dateStr = getFormattedDate(dateObj);
      const scheduleInfo = getClinicScheduleForDate(dateObj);

      const isPast = dateStr < todayStr;
      const isAllowedDay = scheduleInfo.allowed;

      dayBtn.textContent = day;
      dayBtn.className = "h-10 text-xs rounded-xl flex items-center justify-center font-medium transition relative";

      if (isPast || !isAllowedDay) {
        dayBtn.classList.add("text-stone-300", "cursor-not-allowed");
        dayBtn.disabled = true;
      } else {
        if (dateStr === selectedDateString) {
          dayBtn.classList.add("bg-[#A67C52]", "text-white", "font-bold");
        } else {
          dayBtn.classList.add("text-stone-700", "hover:bg-stone-200");
        }

        dayBtn.addEventListener("click", () => {
          selectedDateString = dateStr;
          currentAssignedClinic = scheduleInfo.clinic;
          renderCalendar();
          loadAvailableSlots(dateStr, dateObj.getDay(), scheduleInfo.clinic);
        });
      }

      calendarDaysGrid.appendChild(dayBtn);
    }
  }

  async function loadAvailableSlots(dateStr, dayOfWeek, assignedClinic) {
    if (selectedDateLabel) selectedDateLabel.textContent = dateStr;
    selectedTimeSlot = null;
    if (bookingForm) bookingForm.classList.remove("hidden");
    if (bookingSuccessMessage) bookingSuccessMessage.classList.add("hidden");
    if (slotsContainer) {
      slotsContainer.innerHTML = `<p class="text-xs text-stone-400 col-span-full py-2 text-center">Consultando disponibilidad...</p>`;
    }

    const parts = dateStr.split('-');
    const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
    if (dayOfWeek === undefined) dayOfWeek = dateObj.getDay();

    if (!assignedClinic) {
      const sched = getClinicScheduleForDate(dateObj);
      assignedClinic = sched.clinic;
    }
    currentAssignedClinic = assignedClinic;

    // Asignación de clínica visual sin bloquear el valor en el POST
    if (clientClinicSelect && assignedClinic) {
      clientClinicSelect.innerHTML = `<option value="${assignedClinic}" selected>${assignedClinic}</option>`;
      clientClinicSelect.classList.add("bg-stone-100", "cursor-not-allowed");
    }

    const currentDayHours = (dayOfWeek === 6) ? HORARIOS_SABADO : HORARIOS_SEMANA;
    let dayRecords = [];

    try {
      dayRecords = await db.getBookedRecords(dateStr);
    } catch (e) {
      console.warn("Aviso al consultar turnos ocupados:", e);
    }

    const isWholeDayBlocked = dayRecords.some(r => r.appointment_time === "ALL_DAY" && r.status === "bloqueado");

    if (adminDayControls) {
      if (isAdminLogged) {
        adminDayControls.classList.remove("hidden");
        adminToggleDayBlockBtn.textContent = isWholeDayBlocked ? "Desbloquear este Día" : "Bloquear este Día Completo";
        adminToggleDayBlockBtn.className = isWholeDayBlocked 
          ? "px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition"
          : "px-3 py-1.5 rounded-xl bg-rose-600 text-white font-semibold hover:bg-rose-700 transition";
      } else {
        adminDayControls.classList.add("hidden");
      }
    }

    if (!slotsContainer) return;
    slotsContainer.innerHTML = "";

    if (isWholeDayBlocked) {
      slotsContainer.innerHTML = `
        <div class="col-span-full p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center text-xs text-rose-700">
          <strong>Día no disponible para atención.</strong><br>
          <span class="text-[11px] opacity-80">Por favor, seleccioná otra fecha habilitada del calendario.</span>
        </div>
      `;
      if (bookingForm) bookingForm.classList.add("hidden");
      return;
    }

    currentDayHours.forEach(time => {
      const record = dayRecords.find(r => String(r.appointment_time).trim() === time.trim());
      const isOccupied = !!record;
      const isBlocked = record && record.status === 'bloqueado';

      const slotWrapper = document.createElement("div");
      slotWrapper.className = "flex flex-col gap-1";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "w-full py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";

      if (isOccupied) {
        btn.classList.add("slot-occupied");
        btn.innerHTML = `${time} <span class="text-[10px] ml-1.5 opacity-70">${isBlocked ? 'Bloqueado' : 'Ocupado'}</span>`;
        btn.disabled = true;
      } else {
        btn.classList.add("slot-available");
        btn.textContent = time;

        btn.addEventListener("click", () => {
          document.querySelectorAll("#slotsContainer button.slot-selected").forEach(b => {
            b.className = "w-full slot-available py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";
          });
          btn.className = "w-full slot-selected py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";
          selectedTimeSlot = time;
        });
      }

      slotWrapper.appendChild(btn);

      if (isAdminLogged) {
        const adminSlotActionBtn = document.createElement("button");
        adminSlotActionBtn.type = "button";
        adminSlotActionBtn.className = "text-[10px] py-0.5 rounded font-bold text-center uppercase tracking-wider transition";

        if (isBlocked) {
          adminSlotActionBtn.classList.add("text-emerald-700", "hover:underline");
          adminSlotActionBtn.textContent = "Desbloquear";
          adminSlotActionBtn.addEventListener("click", async () => {
            await db.deleteAppointment(record.id);
            loadAvailableSlots(dateStr, dayOfWeek, assignedClinic);
          });
        } else if (!isOccupied) {
          adminSlotActionBtn.classList.add("text-stone-400", "hover:text-rose-600");
          adminSlotActionBtn.textContent = "Bloquear";
          adminSlotActionBtn.addEventListener("click", async () => {
            await db.insertAppointment({
              appointment_date: dateStr,
              appointment_time: time,
              client_name: "ADMINISTRACIÓN",
              client_phone: "-",
              treatment: `Horario reservado (${assignedClinic})`,
              status: "bloqueado"
            });
            loadAvailableSlots(dateStr, dayOfWeek, assignedClinic);
          });
        }
        slotWrapper.appendChild(adminSlotActionBtn);
      }

      slotsContainer.appendChild(slotWrapper);
    });
  }

  if (adminToggleDayBlockBtn) {
    adminToggleDayBlockBtn.addEventListener("click", async () => {
      if (!selectedDateString) return;
      try {
        const records = await db.getBookedRecords(selectedDateString);
        const blockRecord = records.find(r => r.appointment_time === "ALL_DAY" && r.status === "bloqueado");

        if (blockRecord) {
          await db.deleteAppointment(blockRecord.id);
        } else {
          await db.insertAppointment({
            appointment_date: selectedDateString,
            appointment_time: "ALL_DAY",
            client_name: "DÍA BLOQUEADO (ADMIN)",
            client_phone: "-",
            treatment: "Fecha bloqueada por la profesional",
            status: "bloqueado"
          });
        }
        loadAvailableSlots(selectedDateString);
      } catch (err) {
        alert("Error al cambiar estado del día: " + err.message);
      }
    });
  }

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!selectedDateString || !selectedTimeSlot) {
        alert("Por favor seleccioná un horario disponible de la lista.");
        return;
      }

      const clientClinic = currentAssignedClinic || (clientClinicSelect ? clientClinicSelect.value : "Sede General");
      const clientName = document.getElementById("clientName").value.trim();
      const clientPhone = document.getElementById("clientPhone").value.trim();
      const clientTreatment = document.getElementById("clientTreatment").value;
      const submitBtn = document.getElementById("submitBookingBtn");

      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando turno...";

      try {
        await db.insertAppointment({
          appointment_date: selectedDateString,
          appointment_time: selectedTimeSlot,
          client_name: clientName,
          client_phone: clientPhone,
          treatment: `${clientTreatment} (${clientClinic})`,
          status: 'pendiente_sena'
        });

        bookingForm.classList.add("hidden");
        
        const waMsg = encodeURIComponent(`Hola! Acabo de reservar un turno en Eternal Plasma Derm:\n\n👤 Nombre: ${clientName}\n🏥 Clínica: ${clientClinic}\n📅 Fecha: ${selectedDateString}\n⏰ Hora: ${selectedTimeSlot} hs\n💆 Tratamiento: ${clientTreatment}\n\nAdjunto aquí el comprobante de la seña (${SENA_VALOR}).`);
        const waLink = `https://wa.me/${WHATSAPP_NUMERO}?text=${waMsg}`;

        bookingSuccessMessage.innerHTML = `
          <div class="p-6 bg-white border border-[#E8DEC8] rounded-2xl text-left space-y-4 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">!</div>
              <div>
                <h5 class="font-serif text-lg font-bold text-stone-900 leading-tight">Turno Pre-reservado</h5>
                <p class="text-xs text-stone-500">Sede de atención: <strong>${clientClinic}</strong></p>
              </div>
            </div>

            <div class="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-stone-500">Monto de la seña:</span>
                <span class="font-bold text-stone-900 text-sm">${SENA_VALOR}</span>
              </div>
              <div class="flex justify-between items-center pt-2 border-t border-stone-200">
                <span class="text-stone-500">Alias Mercado Pago:</span>
                <span id="copyAliasTarget" class="font-mono font-bold text-[#A67C52] bg-white px-2 py-0.5 rounded border border-stone-200">${MP_ALIAS}</span>
              </div>
              <button type="button" id="copyAliasBtn" class="w-full text-center text-[11px] text-[#A67C52] font-semibold hover:underline mt-1">
                📋 Copiar Alias
              </button>
            </div>

            <a href="${waLink}" target="_blank" rel="noopener" class="block text-center w-full py-3 rounded-xl bg-emerald-600 text-white font-medium text-xs tracking-wider uppercase hover:bg-emerald-700 transition shadow">
              Enviar Comprobante por WhatsApp
            </a>
            <p class="text-[11px] text-stone-400 text-center">Tenés 2 horas para enviar el comprobante antes de que el turno se libere.</p>
          </div>
        `;
        bookingSuccessMessage.classList.remove("hidden");

        const copyBtn = document.getElementById("copyAliasBtn");
        if (copyBtn) {
          copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(MP_ALIAS);
            copyBtn.textContent = "✅ ¡Alias copiado al portapapeles!";
            setTimeout(() => { copyBtn.textContent = "📋 Copiar Alias"; }, 3000);
          });
        }

        const dateParts = selectedDateString.split('-');
        const selectedDayOfWeek = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay();
        loadAvailableSlots(selectedDateString, selectedDayOfWeek, clientClinic);

      } catch (err) {
        alert("No se pudo procesar la solicitud: " + err.message);
        console.error(err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirmar Turno";
      }
    });
  }

  // ============================================================
  // PANEL DE ADMINISTRACIÓN Y FUNCIONES ESPECIALES
  // ============================================================
  function showAdminDashboard() {
    if (adminLoginView) adminLoginView.classList.add("hidden");
    if (adminDashboardView) adminDashboardView.classList.remove("hidden");
    fetchAdminAppointments();
  }

  if (openAdminBtn && adminModal) {
    openAdminBtn.addEventListener("click", () => {
      adminModal.classList.remove("hidden");
      if (isAdminLogged) {
        showAdminDashboard();
      } else {
        if (adminLoginView) adminLoginView.classList.remove("hidden");
        if (adminDashboardView) adminDashboardView.classList.add("hidden");
      }
    });
  }

  if (openAdminDashboardBtn && adminModal) {
    openAdminDashboardBtn.addEventListener("click", () => {
      adminModal.classList.remove("hidden");
      showAdminDashboard();
    });
  }

  if (closeAdminBtn && adminModal) {
    closeAdminBtn.addEventListener("click", () => {
      adminModal.classList.add("hidden");
    });
  }

  if (adminLoginBtn) {
    adminLoginBtn.addEventListener("click", () => {
      const enteredPass = adminPasswordInput ? adminPasswordInput.value : "";
      if (enteredPass === ADMIN_PASSWORD) {
        isAdminLogged = true;
        sessionStorage.setItem("eternal_admin_auth", "true");
        if (adminLoginError) adminLoginError.classList.add("hidden");
        syncAdminUI();
        showAdminDashboard();
        if (selectedDateString) {
          loadAvailableSlots(selectedDateString);
        }
      } else {
        if (adminLoginError) adminLoginError.classList.remove("hidden");
      }
    });
  }

  if (adminLogoutBtn) {
    adminLogoutBtn.addEventListener("click", () => {
      isAdminLogged = false;
      sessionStorage.removeItem("eternal_admin_auth");
      syncAdminUI();
      if (adminModal) adminModal.classList.add("hidden");
      if (selectedDateString) {
        loadAvailableSlots(selectedDateString);
      }
      alert("Sesión de administrador cerrada correctamente.");
    });
  }

  if (refreshAdminBtn) {
    refreshAdminBtn.addEventListener("click", fetchAdminAppointments);
  }

  if (adminStatusFilter) {
    adminStatusFilter.addEventListener("change", fetchAdminAppointments);
  }

  async function fetchAdminAppointments() {
    if (!adminAppointmentsList) return;
    adminAppointmentsList.innerHTML = `<p class="text-xs text-stone-400 py-6 text-center">Cargando base de datos en tiempo real...</p>`;

    let list = [];
    try {
      list = await db.getAllAppointments();
    } catch (e) {
      console.error(e);
    }

    const selectedFilter = adminStatusFilter ? adminStatusFilter.value : "todos";
    let filteredList = list;
    if (selectedFilter !== "todos") {
      filteredList = list.filter(item => item.status === selectedFilter);
    }

    if (filteredList.length === 0) {
      adminAppointmentsList.innerHTML = `<div class="p-8 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">No se encontraron registros para el filtro seleccionado.</div>`;
      return;
    }

    adminAppointmentsList.innerHTML = "";
    filteredList.forEach(app => {
      const card = document.createElement("div");
      card.className = "p-4 bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition hover:border-[#A67C52]/40";
      
      const cleanPhone = app.client_phone ? app.client_phone.replace(/\D/g, '') : '';
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${app.client_name}, nos comunicamos de Eternal Plasma Derm respecto a tu turno del ${app.appointment_date} (${app.appointment_time} hs).`)}`;

      const isPending = app.status === 'pendiente_sena';
      const isBlocked = app.status === 'bloqueado';

      let statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">✅ Confirmado</span>`;
      if (isPending) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">⏳ Pendiente Seña</span>`;
      } else if (isBlocked) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">🚫 Bloqueo Admin</span>`;
      }

      card.innerHTML = `
        <div class="space-y-1.5 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-sm text-stone-900">${app.client_name}</span>
            <span class="px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-stone-300 text-stone-700 font-semibold text-[11px]">
              📅 ${app.appointment_date} · ⏰ ${app.appointment_time === 'ALL_DAY' ? 'DÍA COMPLETO' : `${app.appointment_time} hs`}
            </span>
            ${statusBadge}
          </div>

          <div class="text-stone-600 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>Detalle: <strong class="text-stone-800 font-medium">${app.treatment}</strong></span>
            ${app.client_phone !== '-' ? `<span>Teléfono: <strong class="text-stone-800 font-medium">${app.client_phone}</strong></span>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          ${cleanPhone && cleanPhone !== '-' ? `
            <a href="${waUrl}" target="_blank" rel="noopener" class="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition flex items-center gap-1.5">
              💬 WhatsApp
            </a>
          ` : ''}

          ${isPending ? `
            <button class="confirm-btn px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition" data-id="${app.id}">
              Confirmar Seña
            </button>
          ` : ''}

          <button class="delete-btn px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium transition flex items-center gap-1" data-id="${app.id}" data-date="${app.appointment_date}" data-time="${app.appointment_time}" data-name="${app.client_name}">
            🗑️ ${isBlocked ? 'Desbloquear' : 'Liberar Turno'}
          </button>
        </div>
      `;

      const confirmBtn = card.querySelector('.confirm-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          const appointmentId = confirmBtn.getAttribute('data-id');
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Actualizando...';

          try {
            await db.updateStatus(appointmentId, 'confirmed');
            fetchAdminAppointments();
          } catch (err) {
            alert('Error al confirmar: ' + err.message);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Confirmar Seña';
          }
        });
      }

      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const appointmentId = deleteBtn.getAttribute('data-id');
          const date = deleteBtn.getAttribute('data-date');
          const time = deleteBtn.getAttribute('data-time');
          const clientName = deleteBtn.getAttribute('data-name');

          const seguro = confirm(`¿Estás seguro de que querés remover el registro de "${clientName}" (${date} - ${time})?\n\nEl horario volverá a quedar disponible para el público.`);
          if (!seguro) return;

          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Liberando...';

          try {
            await db.deleteAppointment(appointmentId);
            fetchAdminAppointments();

            if (selectedDateString === date) {
              const dateParts = date.split('-');
              const dayIdx = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]).getDay();
              loadAvailableSlots(date, dayIdx);
            }
          } catch (err) {
            alert('Error al liberar turno: ' + err.message);
            deleteBtn.disabled = false;
            deleteBtn.textContent = '🗑️ Liberar';
          }
        });
      }

      adminAppointmentsList.appendChild(card);
    });
  }

  if (prevMonthBtn) {
    prevMonthBtn.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (nextMonthBtn) {
    nextMonthBtn.addEventListener("click", () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      renderCalendar();
    });
  }

  syncAdminUI();
  renderCalendar();
});
