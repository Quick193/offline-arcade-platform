import type { ProfileStats } from '@/engine/ProfileManager';

interface ProfileScreenProps {
  profile: ProfileStats;
}

function formatPlaytime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

export function ProfileScreen({ profile }: ProfileScreenProps): JSX.Element {
  const gamesPlayed = Object.values(profile.gamesPlayed).reduce((sum, value) => sum + value, 0);
  const best = Object.entries(profile.bestScores)
    .sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="profile-grid">
      <div className="stat-card">
        <div className="label">Total Playtime</div>
        <div className="value">{formatPlaytime(profile.totalPlaytimeMs)}</div>
      </div>
      <div className="stat-card">
        <div className="label">Sessions</div>
        <div className="value">{profile.sessions}</div>
      </div>
      <div className="stat-card">
        <div className="label">Games Played</div>
        <div className="value">{gamesPlayed}</div>
      </div>
      <div className="stat-card">
        <div className="label">Top Score</div>
        <div className="value">{best ? `${best[0]}: ${best[1]}` : 'N/A'}</div>
      </div>
    </div>
  );
}
