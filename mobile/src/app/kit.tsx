import { Redirect } from "expo-router";
import { ArrowLeft, Bell, Calendar, Check, Copy, Fuel, History, LayoutGrid, Pencil, Plane, Plus, Search, ShoppingBag, Smartphone, Sparkles, User, Utensils } from "lucide-react-native";
import { useState } from "react";

import { todayLocal } from "@/lib/dates";
import {
  BudgetRow,
  BudgetTable,
  CategoryChoice,
  DashedChoice,
  DateChip,
  Dial,
  FieldButton,
  GoalTile,
  PillButton,
  ReadyCard,
  Toggle,
  Chip,
  CircleButton,
  goBack,
  IconTile,
  Illustration,
  Panel,
  Pill,
  PrimaryButton,
  RichText,
  Row,
  Screen,
  SecondaryButton,
  showToast,
  Stack,
  Title,
} from "@/ui";

// Dev-only gallery of the design v3 kit (DESIGN.md §3) and illustrations (§2), to check
// against design/screens/*.png. Opened from Profile → "Design kit" in development builds.
export default function KitScreen() {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [view, setView] = useState<"active" | "completed">("active");
  const [date, setDate] = useState(todayLocal);
  if (!__DEV__) return <Redirect href="/" />;
  const tap = (what: string) => () => showToast(what);

  return (
    <Screen surface="screen">
      <Row gap="md">
        <CircleButton icon={ArrowLeft} label="Go back" onPress={goBack} />
        <Title>{"DESIGN\nKIT"}</Title>
      </Row>

      <Title size="cardTitle">Illustrations</Title>
      <Illustration name="login_hero" width={320} />
      <Illustration name="budget_plate" width={300} />
      <Row gap="md">
        <Illustration name="avatar_user" width={56} />
        <Illustration name="avatar_user" width={42} />
        <Illustration name="avatar_user" width={28} />
        <Illustration name="avatar_ai" width={30} />
        <Illustration name="goal_badge" width={128} />
      </Row>

      <Title size="cardTitle">Titles</Title>
      <Title size="titleXL">Budget</Title>
      <Title>{"MONEY\nBUDDY"}</Title>
      <Title size="cardTitle">{"TOTAL\nBALANCE"}</Title>

      <Title size="cardTitle">Circle buttons</Title>
      <Row gap="sm">
        <CircleButton icon={ArrowLeft} label="Back" onPress={tap("back")} />
        <CircleButton icon={Search} label="Search" variant="outline" onPress={tap("search")} />
        <CircleButton icon={Bell} label="Alerts" variant="outline" onPress={tap("alerts")} />
        <CircleButton icon={History} label="History" variant="ink" onPress={tap("history")} />
        <CircleButton icon={Pencil} label="Edit" size={38} onPress={tap("edit (38)")} />
      </Row>

      <Title size="cardTitle">Pills</Title>
      <Pill knob icon={Calendar} label="September 2026" onPress={tap("month")} />
      <Row gap="sm">
        <Pill label="all" onPress={tap("all")} />
        <Pill label="Sep" variant="outlinedDark" onPress={tap("Sep")} />
        <Pill label="this week" variant="card" onPress={tap("this week")} />
      </Row>

      <Title size="cardTitle">Chips</Title>
      <Row gap="xs" wrap>
        <Chip label="All" selected onPress={tap("All")} />
        <Chip label="Expenses" variant="card" onPress={tap("Expenses")} />
        <Chip label="All spend" dot="tomato" />
        <Chip label="Food" variant="translucent" dot="marigold" />
        <Chip label="Food & Dining" variant="lavender" />
        <Chip label="Plan my month" variant="ink" icon={Calendar} />
      </Row>
      <Panel color="cream">
        <Row gap="xs" wrap>
          <Chip label="UPI" variant="ink" selected onPress={tap("UPI")} />
          <Chip label="Cash" variant="outlined" onPress={tap("Cash")} />
          <Chip label="Today" variant="outlined" icon={Calendar} onPress={tap("Today")} />
        </Row>
      </Panel>

      <Title size="cardTitle">Rich text</Title>
      <Panel>
        <RichText tone="card" links={{ budget: tap("→ Budget"), goals: tap("→ Goals") }}>
          {"Up {mint:+₹17,860} this month. {hi@budget:₹4,860} is ready to assign and {dark@goals:3 goals} are on track."}
        </RichText>
      </Panel>
      <Panel>
        <RichText>
          {"Hi, Bhagy, {dark:September} looks steady, but {dark:Food} is at {hi:79%} and {dark:Groceries} is over by {coral:₹1,200}."}
        </RichText>
      </Panel>
      <Panel color="sage">
        <RichText tone="ink">{"Log a spend in {mint:3 taps}, or just ask where it all went."}</RichText>
      </Panel>

      <Title size="cardTitle">Icon tiles</Title>
      <Row gap="sm">
        <IconTile icon={Utensils} color="tomato" size={30} />
        <IconTile icon={Smartphone} color="sky" size={44} />
        <IconTile icon={ShoppingBag} color="peri2" size={46} />
        <IconTile icon={Fuel} color="marigold" size={58} />
      </Row>

      <Title size="cardTitle">Panels</Title>
      <Panel onPress={tap("card")} label="Pressable card">
        <Title size="cardTitle">{"PRESS\nME"}</Title>
      </Panel>
      <Panel color="peri" large>
        <Title size="cardTitle">{"SPEND\nPULSE"}</Title>
      </Panel>
      <Panel color="marigold" large>
        <Title size="cardTitle" tone="ink">
          Food & Dining
        </Title>
      </Panel>

      <Title size="cardTitle">Buttons</Title>
      <PrimaryButton label="Log in" onPress={tap("log in")} />
      <PrimaryButton label="Save ₹250" icon={Check} onPress={() => new Promise((done) => setTimeout(done, 1200))} />
      <PrimaryButton label="Contribute" icon={Plus} disabled onPress={tap("never")} />
      <SecondaryButton label="Save & add another" surface="dark" onPress={tap("secondary dark")} />
      <Panel color="cream">
        <Stack gap="sm">
          <SecondaryButton label="Save & add another" onPress={tap("secondary light")} />
          <Chip label="Checked Food & Dining · 14 orders" variant="outlined" icon={Sparkles} />
        </Stack>
      </Panel>

      <Title size="cardTitle">Quick add</Title>
      <Panel color="cream">
        <Stack gap="md">
          <Toggle options={[{ label: "Expense", value: "expense" }, { label: "Income", value: "income" }] as const} value={kind} onChange={setKind} />
          <Chip variant="mint" icon={Sparkles} label="Swiggy → Food, like last time" />
          <Row justify="between" align="start">
            <CategoryChoice name="Food" selected onPress={tap("food")} />
            <CategoryChoice name="Groceries" selected={false} onPress={tap("groceries")} />
            <CategoryChoice name="Fuel" selected={false} onPress={tap("fuel")} />
            <DashedChoice label="More" icon={LayoutGrid} a11y="More" onPress={tap("more")} />
          </Row>
          <FieldButton icon={User} label="Payee" value="Swiggy" placeholder="Add a payee" hint="payee" onPress={tap("payee")} />
          <Row gap="xs" wrap>
            <Chip label="UPI" variant="ink" />
            <Chip label="Cash" variant="outlined" />
            <DateChip value={date} onChange={setDate} />
          </Row>
        </Stack>
      </Panel>

      <Title size="cardTitle">Budget</Title>
      <ReadyCard
        amount="₹4,860"
        line="give every rupee a job"
        action={<PillButton label="Copy Aug" icon={Copy} onPress={tap("copy")} />}
        secondary={<Chip variant="outlined" icon={Sparkles} label="Auto-assign · soon" onPress={tap("auto-assign")} />}
      />
      <BudgetTable>
        <BudgetRow first name="Rent" dot="peri" assigned="₹18,000" state={{ kind: "done", available: "₹0", line: "fully spent", barPercent: 100 }} onPress={tap("rent")} />
        <BudgetRow name="Food" dot="tomato" assigned="₹8,000" state={{ kind: "left", available: "₹1,700", line: "₹6,300 of ₹8,000 spent", barPercent: 79 }} onPress={tap("food")} />
        <BudgetRow name="Groceries" dot="mint" assigned="₹5,000" state={{ kind: "over", available: "−₹1,200", line: "overspent by ₹1,200", barPercent: 100 }} onPress={tap("groceries")} />
      </BudgetTable>
      <BudgetTable loading />

      <Title size="cardTitle">Goals</Title>
      <Toggle look="sage" options={[{ label: "Active", value: "active" }, { label: "Achieved", value: "completed" }] as const} value={view} onChange={setView} />
      <Dial percent={67} title="New iPhone" amount="₹54,000" sub="of ₹80,000 · 67%" label="New iPhone, 67%" />
      <Row gap="sm">
        <Chip variant="creamLine" icon={Calendar} label="92 days left" />
        <CircleButton icon={Pencil} variant="line" size={58} label="Edit" onPress={tap("edit (58)")} />
        <CircleButton icon={ArrowLeft} variant="sage" label="Back" onPress={tap("back (sage)")} />
      </Row>
      <Row align="stretch">
        <GoalTile icon={Plane} color="sky" title="Goa trip" amounts="₹9K of ₹25K" percent={36} onPress={tap("goa")} />
        <GoalTile icon={Smartphone} color="mint" title="Emergency fund" amounts="₹40K of ₹1L" percent={40} onPress={tap("fund")} />
      </Row>
    </Screen>
  );
}
