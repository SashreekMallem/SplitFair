/**
 * Penalty Assignment Algorithm
 * 
 * This algorithm handles assigning extra chores to users based on their penalty points.
 */

// Penalty point thresholds and corresponding extra tasks
const PENALTY_THRESHOLDS = [
  { threshold: 3, extraTasks: 1, message: 'Minor penalty: 1 extra task this week' },
  { threshold: 5, extraTasks: 2, message: 'Moderate penalty: 2 extra tasks this week' },
  { threshold: 8, extraTasks: 3, message: 'Severe penalty: 3 extra tasks this week' },
  { threshold: 10, extraTasks: 4, message: 'Major penalty: 4 extra tasks this week plus a meeting with housemates' }
];

// Store for pending penalties (would connect to backend in real app)
let penaltyPointsStore: Record<string, number> = {};

/**
 * Add penalty points to a user and determine if penalties should be applied
 */
export const addPenaltyPoints = async (
  userId: string, 
  points: number, 
  taskId: string,
  reason: string,
  notes?: string
): Promise<void> => {
  // In a real app, this would be a database call
  if (!penaltyPointsStore[userId]) {
    penaltyPointsStore[userId] = 0;
  }
  
  penaltyPointsStore[userId] += points;
  
  console.log(`Added ${points} penalty points to user ${userId}. New total: ${penaltyPointsStore[userId]}`);
  
  // Check if user crossed any thresholds and apply penalties if needed
  const appliedPenalty = checkAndApplyPenalties(userId);
  
  // In a real app, we'd also log this to a history table
  return Promise.resolve();
};

/**
 * Get the current penalty points for a user
 */
export const getUserPenaltyPoints = (userId: string): number => {
  return penaltyPointsStore[userId] || 0;
};

/**
 * Check if penalties need to be applied based on points
 */
export const checkAndApplyPenalties = (userId: string): { applied: boolean, message?: string } => {
  const points = penaltyPointsStore[userId] || 0;
  
  // Find the highest threshold the user has hit
  for (let i = PENALTY_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= PENALTY_THRESHOLDS[i].threshold) {
      // Apply penalty - in a real app, this would create extra tasks or modify task assignments
      return { 
        applied: true, 
        message: PENALTY_THRESHOLDS[i].message 
      };
    }
  }
  
  return { applied: false };
};

/**
 * Reset penalty points for a user after penalties have been applied
 */
export const resetPenaltyPoints = (userId: string): void => {
  penaltyPointsStore[userId] = 0;
};

/**
 * Generate extra chores for a user based on penalty points
 * In a real app, this would interact with the task creation system
 */
export const generateExtraChoresForUser = async (
  userId: string,
  homeId: string,
  numChores: number
): Promise<string[]> => {
  // In a real app, this would create actual chores in the database
  // and return their IDs. For now, we'll just return placeholder IDs
  
  const choreTypes = [
    'Take out trash',
    'Clean common areas',
    'Do dishes',
    'Vacuum all floors',
    'Clean bathrooms',
    'Wipe kitchen surfaces',
    'Mop floors'
  ];
  
  const newChoreIds: string[] = [];
  
  // Simulate creating chores
  for (let i = 0; i < numChores; i++) {
    const choreType = choreTypes[Math.floor(Math.random() * choreTypes.length)];
    const fakeId = `penalty-${userId}-${Date.now()}-${i}`;
    
    console.log(`Assigning penalty chore: ${choreType} to user ${userId}`);
    newChoreIds.push(fakeId);
    
    // In a real app, you would call your task creation API here
  }
  
  return newChoreIds;
};
