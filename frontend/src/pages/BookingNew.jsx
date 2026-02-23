import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { machineAPI, bookingAPI } from '../services/api';
import { Card, PageHeader, Button, Spinner } from '../components/UI';
import { CalendarPlus, Clock, WashingMachine, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, addMinutes as addMin, parseISO, startOfDay, isToday, isBefore, isAfter, isEqual } from 'date-fns';
import toast from 'react-hot-toast';

// Generate all possible 15-minute time slots for a given day (6 AM – 11 PM)
function generateTimeSlots(dateStr, durationMinutes, occupiedBlocks, bufferMinutes) {
  const dayStart = parseISO(`${dateStr}T06:00:00`);
  const dayEnd = parseISO(`${dateStr}T23:00:00`);
  const now = new Date();
  const slots = [];

  let cursor = dayStart;
  while (isBefore(cursor, dayEnd)) {
    const slotEnd = addMin(cursor, durationMinutes);
    // Don't show slots that end after closing
    if (isAfter(slotEnd, addMin(dayEnd, 1))) break;
    // Don't show past slots
    const isPast = isBefore(cursor, now);
    // Check if this slot overlaps any occupied block (including buffer)
    const isOccupied = occupiedBlocks.some((block) => {
      const blockStart = new Date(block.startTime);
      const blockEnd = new Date(block.endTime); // already includes buffer from backend
      return isBefore(cursor, blockEnd) && isAfter(slotEnd, blockStart);
    });

    slots.push({
      startTime: cursor.toISOString(),
      available: !isPast && !isOccupied,
    });
    cursor = addMin(cursor, 15); // 15-minute intervals
  }
  return slots;
}

export default function BookingNew() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselected = searchParams.get('machine');

  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(preselected || '');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [duration, setDuration] = useState(30);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    machineAPI.getAll()
      .then(({ data }) => {
        const list = data.data?.machines || data.data || [];
        setMachines(list);
        if (!preselected && list.length > 0) {
          const avail = list.find((m) => m.status === 'available');
          if (avail) setSelectedMachine(avail.machineId);
        }
      })
      .finally(() => setLoading(false));
  }, [preselected]);

  useEffect(() => {
    if (!selectedMachine || !selectedDate) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    bookingAPI.getSlots(selectedMachine, selectedDate)
      .then(({ data }) => {
        const resp = data.data || {};
        const occupied = resp.occupiedBlocks || [];
        const buffer = resp.bufferMinutes || 10;
        const generated = generateTimeSlots(selectedDate, duration, occupied, buffer);
        setSlots(generated);
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedMachine, selectedDate, duration]);

  const handleBook = async () => {
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }
    setBooking(true);
    try {
      await bookingAPI.create({
        machineId: selectedMachine,
        startTime: selectedSlot,
        durationMinutes: duration,
      });
      toast.success('Booking confirmed!');
      navigate('/bookings');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const changeDate = (offset) => {
    const d = addDays(parseISO(selectedDate), offset);
    const today = startOfDay(new Date());
    if (d < today) return;
    const max = addDays(today, 7);
    if (d > max) return;
    setSelectedDate(format(d, 'yyyy-MM-dd'));
  };

  if (loading) return <Spinner />;

  const availableMachines = machines.filter((m) => m.status === 'available');

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Book a Machine" subtitle="Select a machine, date, and time slot" />

      {/* Step 1: Machine */}
      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <WashingMachine className="w-5 h-5 text-primary-600" />
          Select Machine
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {availableMachines.length === 0 ? (
            <p className="text-sm text-gray-500 col-span-2">No machines available right now</p>
          ) : (
            availableMachines.map((m) => (
              <button key={m.machineId}
                onClick={() => setSelectedMachine(m.machineId)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition ${
                  selectedMachine === m.machineId
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className="w-8 h-8 bg-accent-100 rounded-lg flex items-center justify-center">
                  <WashingMachine className="w-4 h-4 text-accent-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.name || m.machineId}</p>
                  <p className="text-xs text-gray-500">{m.location}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </Card>

      {/* Step 2: Date + Duration */}
      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CalendarPlus className="w-5 h-5 text-primary-600" />
          Date & Duration
        </h3>
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center flex-1">
            <p className="text-lg font-semibold text-gray-900">
              {isToday(parseISO(selectedDate)) ? 'Today' : format(parseISO(selectedDate), 'EEE, MMM d')}
            </p>
            <p className="text-xs text-gray-500">{selectedDate}</p>
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
          <div className="flex gap-2">
            {[15, 30, 45, 60].map((d) => (
              <button key={d} onClick={() => setDuration(d)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  duration === d
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                {d} min
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Step 3: Time Slots */}
      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-600" />
          Available Slots
        </h3>

        {slotsLoading ? (
          <Spinner size="sm" />
        ) : slots.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No slots available for this date</p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {slots.map((slot) => {
              const time = slot.startTime;
              const isAvail = slot.available;
              const display = formatSlotTime(time);

              return (
                <button key={time} disabled={!isAvail}
                  onClick={() => setSelectedSlot(time)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    selectedSlot === time
                      ? 'bg-primary-600 text-white'
                      : isAvail
                        ? 'bg-gray-50 text-gray-700 hover:bg-primary-50 hover:text-primary-700 border border-gray-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                  }`}>
                  {display}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Confirm */}
      <Button onClick={handleBook} loading={booking} size="lg" className="w-full">
        Confirm Booking
      </Button>
    </div>
  );
}

function formatSlotTime(time) {
  try {
    const d = typeof time === 'string' ? parseISO(time) : time;
    return format(d, 'h:mm a');
  } catch {
    return time;
  }
}
