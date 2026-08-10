export const queryKeys = {
  profile: (userId: string | undefined) => ["profile", userId] as const,
  feed: (userId: string | undefined) => ["feed", userId] as const,
  memberProfile: (userId: string) => ["member-profile", userId] as const,
  suspended: (userId: string | undefined) => ["suspended", userId] as const,
  credits: (userId: string | undefined) => ["credits", userId] as const,
  mySubscription: (userId: string | undefined) => ["my-subscription", userId] as const,
  conciergeConversations: (userId: string | undefined) =>
    ["concierge-conversations", userId] as const,
  // `staffGate` and the five `admin*` keys are deliberately absent — Appendix A.
  // Mobile is a member application; those surfaces do not exist here in any form.
  subscriptionPlans: ["subscription-plans"] as const,
  savedPalettes: (userId: string | undefined) => ["saved-palettes", userId] as const,
  similarItems: (postItemId: string) => ["similar-items", postItemId] as const,
};
