import type { Achievement } from '@/engine/AchievementManager';
import { Card } from '@/ui/Card';

interface AchievementScreenProps {
  achievements: Achievement[];
}

export function AchievementScreen({ achievements }: AchievementScreenProps): JSX.Element {
  return (
    <div className="achievements-grid">
      {achievements.map((achievement) => (
        <Card key={achievement.id} className={`achievement-card ${achievement.unlockedAt ? 'unlocked' : 'locked'}`}>
          <div className="title">{achievement.title}</div>
          <div>{achievement.description}</div>
          <div className="stamp">
            {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString() : 'Locked'}
          </div>
        </Card>
      ))}
    </div>
  );
}
