/* ============================================================
   ETERNAL PLASMA DERM - LÓGICA DE TURNOS Y CONEXIÓN
   ============================================================ */

const SUPABASE_URL = "https://izmumxhupaybploxfbft.supabase.co";
const SUPABASE_KEY = "sb_publishable_oavikFmXuEZM5FROfyMaew_KXnZAivY";
const ADMIN_PASSWORD = "eternaladmin2026";

// DATOS DE MERCADO PAGO Y CONTACTO
const MP_ALIAS = "patogil.mp";
const SENA_VALOR = "$20.000";
const WHATSAPP_NUMERO = "5492641234567";

// Esquema de horarios según el día
const HORARIOS_SEMANA = ["16:00", "17:15", "18:30", "19:45"];
const HORARIOS_SABADO = ["09:30", "11:00", "12:30", "15:00", "16:30", "18:00", "19:30"];

// Cliente REST nativo configurado para las nuevas Publishable Keys (solo header apikey)
const db = {
  async getBookedTimes(dateStr) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?appointment_date=eq.${dateStr}&select=appointment_time`, {
      method: "GET",
      headers: {
        "apikey": SUPABASE_KEY
      }
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.map(item => String(item.appointment_time).trim());
  },

  async insertAppointment(payload) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
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
      headers: {
        "apikey": SUPABASE_KEY
      }
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  },

  async updateStatus(id, newStatus) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) throw new Error(await res.text());
  },

  async deleteAppointment(id) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/appointments?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        "apikey": SUPABASE_KEY
      }
    });
    if (!res.ok) throw new Error(await res.text());
  }
};

let currentDate = new Date();
let selectedDateString = null;
let selectedTimeSlot = null;

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

  // Elementos de Admin
  const adminModal = document.getElementById("adminModal");
  const openAdminBtn = document.getElementById("openAdminBtn");
  const closeAdminBtn = document.getElementById("closeAdminBtn");
  const adminLoginView = document.getElementById("adminLoginView");
  const adminDashboardView = document.getElementById("adminDashboardView");
  const adminPasswordInput = document.getElementById("adminPasswordInput");
  const adminLoginBtn = document.getElementById("adminLoginBtn");
  const adminLoginError = document.getElementById("adminLoginError");
  const adminAppointmentsList = document.getElementById("adminAppointmentsList");
  const refreshAdminBtn = document.getElementById("refreshAdminBtn");

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
      const isPast = dateStr < todayStr;
      const isSunday = dateObj.getDay() === 0;

      dayBtn.textContent = day;
      dayBtn.className = "h-10 text-xs rounded-xl flex items-center justify-center font-medium transition";

      if (isPast || isSunday) {
        dayBtn.classList.add("text-stone-300", "cursor-not-allowed");
        dayBtn.disabled = true;
      } else {
        if (dateStr === selectedDateString) {
          dayBtn.classList.add("bg-[#A67C52]", "text-white", "font-bold");
        } else {
          dayBtn.classList.add("text-stone-700", "hover:bg-stone-100");
        }

        dayBtn.addEventListener("click", () => {
          selectedDateString = dateStr;
          renderCalendar();
          loadAvailableSlots(dateStr, dateObj.getDay());
        });
      }

      calendarDaysGrid.appendChild(dayBtn);
    }
  }

  async function loadAvailableSlots(dateStr, dayOfWeek) {
    if (selectedDateLabel) selectedDateLabel.textContent = dateStr;
    selectedTimeSlot = null;
    if (bookingForm) bookingForm.classList.remove("hidden");
    if (bookingSuccessMessage) bookingSuccessMessage.classList.add("hidden");
    if (slotsContainer) {
      slotsContainer.innerHTML = `<p class="text-xs text-stone-400 col-span-full py-2 text-center">Consultando disponibilidad...</p>`;
    }

    if (dayOfWeek === undefined) {
      const parts = dateStr.split('-');
      dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    }

    const currentDayHours = (dayOfWeek === 6) ? HORARIOS_SABADO : HORARIOS_SEMANA;
    let occupiedTimes = [];

    try {
      occupiedTimes = await db.getBookedTimes(dateStr);
    } catch (e) {
      console.warn("Aviso al consultar turnos ocupados:", e);
    }

    if (!slotsContainer) return;
    slotsContainer.innerHTML = "";

    currentDayHours.forEach(time => {
      const isOccupied = occupiedTimes.includes(time.trim());
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";

      if (isOccupied) {
        btn.classList.add("slot-occupied");
        btn.innerHTML = `${time} <span class="text-[10px] ml-1.5 opacity-60">Ocupado</span>`;
        btn.disabled = true;
      } else {
        btn.classList.add("slot-available");
        btn.textContent = time;

        btn.addEventListener("click", () => {
          document.querySelectorAll("#slotsContainer button").forEach(b => {
            if (!b.disabled) b.className = "slot-available py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";
          });
          btn.className = "slot-selected py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";
          selectedTimeSlot = time;
        });
      }

      slotsContainer.appendChild(btn);
    });
  }

  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!selectedDateString || !selectedTimeSlot) {
        alert("Por favor seleccioná un horario disponible de la lista.");
        return;
      }

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
          treatment: clientTreatment,
          status: 'pendiente_sena'
        });

        bookingForm.classList.add("hidden");
        
        const waMsg = encodeURIComponent(`Hola! Acabo de reservar un turno en Eternal Plasma Derm:\n\n👤 Nombre: ${clientName}\n📅 Fecha: ${selectedDateString}\n⏰ Hora: ${selectedTimeSlot} hs\n💆 Tratamiento: ${clientTreatment}\n\nAdjunto aquí el comprobante de la seña (${SENA_VALOR}).`);
        const waLink = `https://wa.me/${WHATSAPP_NUMERO}?text=${waMsg}`;

        bookingSuccessMessage.innerHTML = `
          <div class="p-6 bg-[#FDFBF7] border border-[#E8DEC8] rounded-2xl text-left space-y-4 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-lg">!</div>
              <div>
                <h5 class="font-serif text-lg font-bold text-stone-900 leading-tight">Turno Pre-reservado</h5>
                <p class="text-xs text-stone-500">Para confirmarlo definitivamente, enviá la seña.</p>
              </div>
            </div>

            <div class="p-4 bg-white rounded-xl border border-stone-200 space-y-2 text-xs">
              <div class="flex justify-between items-center">
                <span class="text-stone-500">Monto de la seña:</span>
                <span class="font-bold text-stone-900 text-sm">${SENA_VALOR}</span>
              </div>
              <div class="flex justify-between items-center pt-2 border-t border-stone-100">
                <span class="text-stone-500">Alias Mercado Pago:</span>
                <span id="copyAliasTarget" class="font-mono font-bold text-[#A67C52] bg-stone-50 px-2 py-0.5 rounded border border-stone-200">${MP_ALIAS}</span>
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
        loadAvailableSlots(selectedDateString, selectedDayOfWeek);

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
  // PANEL DE ADMINISTRACIÓN (LIBERAR / CONFIRMAR TURNOS)
  // ============================================================
  if (openAdminBtn && adminModal) {
    openAdminBtn.addEventListener("click", () => {
      adminModal.classList.remove("hidden");
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
        if (adminLoginError) adminLoginError.classList.add("hidden");
        if (adminLoginView) adminLoginView.classList.add("hidden");
        if (adminDashboardView) adminDashboardView.classList.remove("hidden");
        fetchAdminAppointments();
      } else {
        if (adminLoginError) adminLoginError.classList.remove("hidden");
      }
    });
  }

  if (refreshAdminBtn) {
    refreshAdminBtn.addEventListener("click", fetchAdminAppointments);
  }

  async function fetchAdminAppointments() {
    if (!adminAppointmentsList) return;
    adminAppointmentsList.innerHTML = `<p class="text-xs text-stone-400 py-6 text-center">Cargando reservas desde la base de datos...</p>`;

    let list = [];
    try {
      list = await db.getAllAppointments();
    } catch (e) {
      console.error(e);
    }

    if (list.length === 0) {
      adminAppointmentsList.innerHTML = `<div class="p-8 text-center text-xs text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">No hay turnos registrados en este momento.</div>`;
      return;
    }

    adminAppointmentsList.innerHTML = "";
    list.forEach(app => {
      const card = document.createElement("div");
      card.className = "p-4 bg-white rounded-2xl border border-stone-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs transition hover:border-[#A67C52]/40";
      
      const cleanPhone = app.client_phone ? app.client_phone.replace(/\D/g, '') : '';
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${app.client_name}, te escribimos de Eternal Plasma Derm sobre tu turno del ${app.appointment_date} a las${app.appointment_time} hs.`)}`;

      const isPending = app.status === 'pendiente_sena';

      card.innerHTML = `
        <div class="space-y-1.5 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-sm text-stone-900">${app.client_name}</span>
            <span class="px-2.5 py-0.5 rounded-full bg-[#FAF8F5] border border-stone-300 text-stone-700 font-semibold text-[11px]">
              📅 ${app.appointment_date} · ⏰ ${app.appointment_time} hs
            </span>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isPending ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}">
              ${isPending ? '⏳ Pendiente Seña' : '✅ Confirmado'}
            </span>
          </div>

          <div class="text-stone-600 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span>Tratamiento: <strong class="text-stone-800 font-medium">${app.treatment}</strong></span>
            <span>Teléfono: <strong class="text-stone-800 font-medium">${app.client_phone}</strong></span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          <a href="${waUrl}" target="_blank" rel="noopener" class="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition flex items-center gap-1.5">
            💬 WhatsApp
          </a>

          ${isPending ? `
            <button class="confirm-btn px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition" data-id="${app.id}">
              Confirmar Seña
            </button>
          ` : ''}

          <button class="delete-btn px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-medium transition flex items-center gap-1" data-id="${app.id}" data-date="${app.appointment_date}" data-time="${app.appointment_time}" data-name="${app.client_name}">
            🗑️ Liberar Horario
          </button>
        </div>
      `;

      // Evento: Confirmar seña
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

      // Evento: Liberar horario
      const deleteBtn = card.querySelector('.delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          const appointmentId = deleteBtn.getAttribute('data-id');
          const date = deleteBtn.getAttribute('data-date');
          const time = deleteBtn.getAttribute('data-time');
          const clientName = deleteBtn.getAttribute('data-name');

          const seguro = confirm(`¿Estás seguro de que querés liberar el turno de las ${time} hs (${date}) reservado por "${clientName}"?\n\nEl horario volverá a figurar disponible para todo el público.`);
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
            deleteBtn.textContent = '🗑️ Liberar Horario';
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

  renderCalendar();
});
