/* ============================================================
   ETERNAL PLASMA DERM - LÓGICA DE TURNOS Y CONEXIÓN
   ============================================================ */

// 1. CREDENCIALES DE SUPABASE (Pegá las tuyas acá)
const SUPABASE_URL = "https://izmumxhupaybploxfbft.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_oavikFmXuEZM5FROfyMaew_KXnZAivY";

// Clave del Administrador para ver los datos de los clientes
const ADMIN_PASSWORD = "eternaladmin2026"; 

// Inicialización de Supabase (con fallback local seguro si aún no se pegan las claves)
const isConfigured = !SUPABASE_URL.includes("TU_SUPABASE");
const supabase = isConfigured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// Horarios habilitados de atención por día
const WORKING_HOURS = [
  "10:00", "11:30", "14:00", "15:30", "17:00", "18:30"
];

// Estado global de la aplicación
let currentDate = new Date();
let selectedDateString = null;
let selectedTimeSlot = null;
let bookedSlotsCache = []; // Turnos ocupados obtenidos de la base de datos

// Fallback de demostración local si aún no pusiste las claves de Supabase
let localDemoAppointments = [
  { appointment_date: getFormattedDate(new Date()), appointment_time: "11:30", client_name: "Cliente Demo", client_phone: "264-000000", treatment: "Lifting Plasma" }
];

// ------------------------------------------------------------
// ELEMENTOS DEL DOM
// ------------------------------------------------------------
const monthYearLabel = document.getElementById("currentMonthYear");
const calendarDaysGrid = document.getElementById("calendarDays");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const selectedDateLabel = document.getElementById("selectedDateLabel");
const slotsContainer = document.getElementById("slotsContainer");
const bookingForm = document.getElementById("bookingForm");
const bookingSuccessMessage = document.getElementById("bookingSuccessMessage");

// Elementos Admin Modal
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

// ------------------------------------------------------------
// UTILIDADES DE FECHA
// ------------------------------------------------------------
function getFormattedDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// ------------------------------------------------------------
// RENDERIZADO DEL CALENDARIO
// ------------------------------------------------------------
function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  monthYearLabel.textContent = `${MONTH_NAMES[month]} ${year}`;
  calendarDaysGrid.innerHTML = "";

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayStr = getFormattedDate(new Date());

  // Rellenar días vacíos antes del primer día del mes
  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "h-10";
    calendarDaysGrid.appendChild(empty);
  }

  // Días del mes
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
        loadAvailableSlots(dateStr);
      });
    }

    calendarDaysGrid.appendChild(dayBtn);
  }
}

// ------------------------------------------------------------
// CARGAR HORARIOS DISPONIBLES / OCUPADOS
// ------------------------------------------------------------
async function loadAvailableSlots(dateStr) {
  selectedDateLabel.textContent = dateStr;
  selectedTimeSlot = null;
  bookingForm.classList.add("hidden");
  bookingSuccessMessage.classList.add("hidden");
  slotsContainer.innerHTML = `<p class="text-xs text-stone-400 col-span-full py-2">Consultando disponibilidad...</p>`;

  let occupiedTimes = [];

  if (isConfigured) {
    try {
      // Consulta a la vista pública de Supabase (sin datos privados de terceros)
      const { data, error } = await supabase
        .from('public_booked_slots')
        .select('appointment_time')
        .eq('appointment_date', dateStr);

      if (!error && data) {
        occupiedTimes = data.map(item => item.appointment_time);
      }
    } catch (e) {
      console.warn("Fallo al consultar Supabase, usando estado en memoria:", e);
    }
  } else {
    // Si todavía no se conectó Supabase, usa el array de prueba
    occupiedTimes = localDemoAppointments
      .filter(a => a.appointment_date === dateStr)
      .map(a => a.appointment_time);
  }

  slotsContainer.innerHTML = "";

  WORKING_HOURS.forEach(time => {
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
        // Desmarcar los demás
        document.querySelectorAll("#slotsContainer button").forEach(b => {
          if (!b.disabled) b.className = "slot-available py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";
        });
        btn.className = "slot-selected py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center transition";
        selectedTimeSlot = time;
        bookingForm.classList.remove("hidden");
      });
    }

    slotsContainer.appendChild(btn);
  });
}

// ------------------------------------------------------------
// ENVIAR RESERVA A LA BASE DE DATOS
// ------------------------------------------------------------
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
  submitBtn.textContent = "Confirmando...";

  try {
    if (isConfigured) {
      const { error } = await supabase
        .from('appointments')
        .insert([{
          appointment_date: selectedDateString,
          appointment_time: selectedTimeSlot,
          client_name: clientName,
          client_phone: clientPhone,
          treatment: clientTreatment,
          status: 'confirmed'
        }]);

      if (error) throw error;
    } else {
      // Mock local
      localDemoAppointments.push({
        appointment_date: selectedDateString,
        appointment_time: selectedTimeSlot,
        client_name: clientName,
        client_phone: clientPhone,
        treatment: clientTreatment
      });
    }

    bookingForm.reset();
    bookingForm.classList.add("hidden");
    bookingSuccessMessage.classList.remove("hidden");
    loadAvailableSlots(selectedDateString);

  } catch (err) {
    alert("No se pudo confirmar el turno. Es posible que el horario acabe de ocuparse.");
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirmar Turno";
  }
});

// ------------------------------------------------------------
// PANEL DE ADMINISTRADOR (VER TURNOS PRIVADOS)
// ------------------------------------------------------------
openAdminBtn.addEventListener("click", () => {
  adminModal.classList.remove("hidden");
});

closeAdminBtn.addEventListener("click", () => {
  adminModal.classList.add("hidden");
});

adminLoginBtn.addEventListener("click", () => {
  const enteredPass = adminPasswordInput.value;
  if (enteredPass === ADMIN_PASSWORD) {
    adminLoginError.classList.add("hidden");
    adminLoginView.classList.add("hidden");
    adminDashboardView.classList.remove("hidden");
    fetchAdminAppointments();
  } else {
    adminLoginError.classList.remove("hidden");
  }
});

refreshAdminBtn.addEventListener("click", () => {
  fetchAdminAppointments();
});

async function fetchAdminAppointments() {
  adminAppointmentsList.innerHTML = `<p class="text-xs text-stone-400 py-4 text-center">Cargando reservas...</p>`;

  let list = [];

  if (isConfigured) {
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (!error && data) list = data;
    } catch (e) {
      console.error(e);
    }
  } else {
    list = [...localDemoAppointments];
  }

  if (list.length === 0) {
    adminAppointmentsList.innerHTML = `<p class="text-xs text-stone-400 py-4 text-center">No hay turnos registrados aún.</p>`;
    return;
  }

  adminAppointmentsList.innerHTML = "";
  list.forEach(app => {
    const card = document.createElement("div");
    card.className = "p-3.5 bg-stone-50 rounded-xl border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs";
    
    // Formatear mensaje para WhatsApp directo
    const cleanPhone = app.client_phone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${app.client_name}, te escribimos de Eternal Plasma Derm para confirmar tu turno del ${app.appointment_date} a las${app.appointment_time} hs.`)}`;

    card.innerHTML = `
      <div>
        <div class="flex items-center gap-2">
          <span class="font-bold text-stone-900">${app.client_name}</span>
          <span class="px-2 py-0.5 rounded bg-[#FAF8F5] border border-stone-300 text-stone-600 font-medium">${app.appointment_date} · ${app.appointment_time} hs</span>
        </div>
        <div class="text-stone-500 mt-1">
          <span>Tratamiento: <strong class="text-stone-700">${app.treatment}</strong></span> · Tel: ${app.client_phone}
        </div>
      </div>
      <div>
        <a href="${waUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition">
          Contactar WhatsApp
        </a>
      </div>
    `;
    adminAppointmentsList.appendChild(card);
  });
}

// ------------------------------------------------------------
// NAVEGACIÓN DE MESES
// ------------------------------------------------------------
prevMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
});

// Inicialización
renderCalendar();