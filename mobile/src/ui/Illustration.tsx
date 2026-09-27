import AvatarAi from "../../design/assets/illustrations/avatar_ai.svg";
import AvatarUser from "../../design/assets/illustrations/avatar_user.svg";
import BudgetPlate from "../../design/assets/illustrations/budget_plate.svg";
import GoalBadge from "../../design/assets/illustrations/goal_badge.svg";
import LoginHero from "../../design/assets/illustrations/login_hero.svg";

// The design's cartoon cast (DESIGN.md §2), imported as components by react-native-svg-transformer
// (metro.config.js; .svgrrc maps the coins' ₹ font to the loaded Barlow). Never redraw them.
// `ratio` is each file's viewBox height / width, so callers only pass a width.
const ART = {
  login_hero: { Art: LoginHero, ratio: 372 / 390 },
  budget_plate: { Art: BudgetPlate, ratio: 238 / 330 },
  avatar_user: { Art: AvatarUser, ratio: 1 },
  avatar_ai: { Art: AvatarAi, ratio: 1 },
  goal_badge: { Art: GoalBadge, ratio: 1 },
} as const;

export type IllustrationName = keyof typeof ART;

export function Illustration({ name, width }: { name: IllustrationName; width: number }) {
  const { Art, ratio } = ART[name];
  return <Art width={width} height={width * ratio} accessible={false} />;
}
