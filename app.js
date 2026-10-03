/* ============================================================
   ETERNAL PLASMA DERM - LÓGICA DE TURNOS Y CONEXIÓN
   ============================================================ */

const SUPABASE_URL = "https://izmumxhupaybploxfbft.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_oavikFmXuEZM5FR0fyMaew_KXnZAivY";
const ADMIN_PASSWORD = "eternaladmin2026";

// DATOS DE MERCADO PAGO Y CONTACTO (Modificá estos valores)
const MP_ALIAS = "patogil.mp"; // Tu alias de Mercado Pago
const SENA_VALOR = "$20.000";          // Monto de la seña
const WHATSAPP_NUMERO = "5492645447043"; // Número para recibir el comprobante

// Esquema de horarios según el día
const HORARIOS_SEMANA = ["16:00", "17:15", "18:30", "19:45"];
const HORARIOS_SABADO = ["09:30", "11:00", "12:30", "15:00", "16:30", "18:00", "19:30"];

// Inicializar cliente Supabase de forma segura
let supabaseClient = null;
try {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  console.error("Error al inicializar Supabase:", e);
}

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
      slotsContainer.innerHTML = `<p class="text-xs text-stone-400 col-span-full py-2">Consultando disponibilidad...</p>`;
    }

    // Determinar qué lista de horarios corresponde según el día
    const currentDayHours = (dayOfWeek === 6) ? HORARIOS_SABADO : HORARIOS_SEMANA;

    let occupiedTimes = [];

    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('appointments')
          .select('appointment_time')
          .eq('appointment_date', dateStr);

        if (!error && data) {
          occupiedTimes = data.map(item => item.appointment_time);
        }
      } catch (e) {
        console.warn("Fallo de consulta:", e);
      }
    }

    if (!slotsContainer) return;
    slotsContainer.innerHTML = "";

    currentDayHours.forEach(time => {
      const isOccupied = occupiedTimes.includes(time);
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
        alert("Por favor elegí una fecha y un horario disponible.");
        return;
      }

      const clientName = document.getElementById("clientName").value.trim();
      const clientPhone = document.getElementById("clientPhone").value.trim();
      const clientTreatment = document.getElementById("clientTreatment").value;
      const submitBtn = document.getElementById("submitBookingBtn");

      submitBtn.disabled = true;
      submitBtn.textContent = "Guardando turno...";

      try {
        if (supabaseClient) {
          const { error } = await supabaseClient
            .from('appointments')
            .insert([{
              appointment_date: selectedDateString,
              appointment_time: selectedTimeSlot,
              client_name: clientName,
              client_phone: clientPhone,
              treatment: clientTreatment,
              status: 'pendiente_sena'
            }]);

          if (error) throw error;
        }

        // Mostrar pantalla de confirmación con instrucciones de Mercado Pago
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

        // Evento para copiar el alias
        const copyBtn = document.getElementById("copyAliasBtn");
        if (copyBtn) {
          copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(MP_ALIAS);
            copyBtn.textContent = "✅ ¡Alias copiado al portapapeles!";
            setTimeout(() => { copyBtn.textContent = "📋 Copiar Alias"; }, 3000);
          });
        }

        // Actualizar visualmente los horarios del día elegido
        const dayIdx = new Date(selectedDateString + "T12:00:00").getDay();
        loadAvailableSlots(selectedDateString, dayIdx);

      } catch (err) {
        alert("No se pudo procesar la solicitud. Es posible que el horario acabe de ocuparse.");
        console.error(err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirmar Turno";
      }
    });
  }

  // Panel de Administrador
  if (openAdminBtn && adminModal) openAdminBtn.addEventListener("click", () => adminModal.classList.remove("hidden"));
  if (closeAdminBtn && adminModal) closeAdminBtn.addEventListener("click", () => adminModal.classList.add("hidden"));

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

  if (refreshAdminBtn) refreshAdminBtn.addEventListener("click", fetchAdminAppointments);

  async function fetchAdminAppointments() {
    if (!adminAppointmentsList) return;
    adminAppointmentsList.innerHTML = `<p class="text-xs text-stone-400 py-4 text-center">Cargando reservas...</p>`;

    let list = [];
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('appointments')
          .select('*')
          .order('appointment_date', { ascending: true })
          .order('appointment_time', { ascending: true });

        if (!error && data) list = data;
      } catch (e) {
        console.error(e);
      }
    }

    if (list.length === 0) {
      adminAppointmentsList.innerHTML = `<p class="text-xs text-stone-400 py-4 text-center">No hay turnos registrados aún.</p>`;
      return;
    }

    adminAppointmentsList.innerHTML = "";
    list.forEach(app => {
      const card = document.createElement("div");
      card.className = "p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs";
      
      const cleanPhone = app.client_phone ? app.client_phone.replace(/\D/g, '') : '';
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${app.client_name}, te escribimos de Eternal Plasma Derm para avisarte que recibimos tu seña y tu turno del ${app.appointment_date} a las${app.appointment_time} hs está 100% confirmado.`)}`;

      card.innerHTML = `
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-stone-900">${app.client_name}</span>
            <span class="px-2 py-0.5 rounded bg-[#FAF8F5] border border-stone-300 text-stone-600 font-medium">${app.appointment_date} · ${app.appointment_time} hs</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${app.status === 'pendiente_sena' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
              ${app.status === 'pendiente_sena' ? 'Pendiente Seña' : 'Confirmado'}
            </span>
          </div>
          <div class="text-stone-500 mt-1">
            <span>Tratamiento: <strong class="text-stone-700">${app.treatment}</strong></span> · Tel: ${app.client_phone}
          </div>
        </div>
        <div>
          <a href="${waUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition">
            Confirmar por WhatsApp
          </a>
        </div>
      `;
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
