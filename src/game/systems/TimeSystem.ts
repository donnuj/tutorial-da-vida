// 1 real second = 1 game minute
// 1 game hour = 60 real seconds
// 1 game day = 1440 real seconds = 24 real minutes
// Age: starts at 0 game minutes (birth)

export class TimeSystem {
  private gameMinutes: number;
  private accumMs = 0;
  private readonly MS_PER_GAME_MINUTE = 1000;

  onDayChange?: (day: number, hour: number) => void;
  onHourChange?: (day: number, hour: number) => void;

  constructor(initialGameMinutes = 0) {
    this.gameMinutes = initialGameMinutes;
  }

  update(deltaMs: number) {
    this.accumMs += deltaMs;
    const minutesPassed = Math.floor(this.accumMs / this.MS_PER_GAME_MINUTE);
    if (minutesPassed === 0) return;

    const prevHour = Math.floor(this.gameMinutes / 60) % 24;
    const prevDay = Math.floor(this.gameMinutes / (60 * 24));

    this.gameMinutes += minutesPassed;
    this.accumMs -= minutesPassed * this.MS_PER_GAME_MINUTE;

    const newHour = Math.floor(this.gameMinutes / 60) % 24;
    const newDay = Math.floor(this.gameMinutes / (60 * 24));

    if (newHour !== prevHour) this.onHourChange?.(newDay, newHour);
    if (newDay !== prevDay) this.onDayChange?.(newDay, newHour);
  }

  get totalGameMinutes() { return this.gameMinutes; }

  get hour(): number { return Math.floor(this.gameMinutes / 60) % 24; }
  get minute(): number { return this.gameMinutes % 60; }
  get day(): number { return Math.floor(this.gameMinutes / (60 * 24)); }
  get yearOfLife(): number { return Math.floor(this.gameMinutes / (60 * 24 * 365)); }

  get timeString(): string {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute).padStart(2, '0');
    return `${h}:${m}`;
  }

  get ageString(): string {
    const years = this.yearOfLife;
    const months = Math.floor((this.gameMinutes % (60 * 24 * 365)) / (60 * 24 * 30));
    if (years === 0) return `${months} ${months === 1 ? 'mês' : 'meses'}`;
    return `${years} ${years === 1 ? 'ano' : 'anos'}`;
  }

  get isAdult(): boolean { return this.yearOfLife >= 18; }

  get ambientLight(): number {
    const h = this.hour;
    if (h >= 6 && h < 8) return 0.7 + ((h - 6) / 2) * 0.3;    // dawn
    if (h >= 8 && h < 18) return 1.0;                            // day
    if (h >= 18 && h < 20) return 1.0 - ((h - 18) / 2) * 0.5;  // dusk
    if (h >= 20 || h < 6) return 0.3 + (h >= 20 ? (20 - h) / 10 : (h + 4) / 10) * 0.3; // night
    return 1.0;
  }

  setGameMinutes(minutes: number) {
    this.gameMinutes = Math.max(0, minutes);
  }
}
