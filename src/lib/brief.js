// Coach brief for a single session: how it should feel, what to do before, during and after, and what to do if it goes wrong.
// Written for Quarter 1 session types. Each brief ties back to the evidence entry for the session (evidence.js).

const GEL = 'SiS BETA FUEL gel (40 g)';

const B = {
  recovery_marathon: {
    feel: 'RPE 2 of 10. You should finish wanting more. That is the point.',
    before: ['Eat normally; no special fuelling needed.', 'Check your legs with 5 minutes of walking first. If calves or quads are still very sore, replace the jog with a walk.'],
    during: ['4 minutes easy jog, 1 minute walk. Do not skip the walks.', 'Short, quick steps. Keep your heart rate under 150, and under 140 if you can.', 'Flat route, soft surface if you have one.'],
    after: ['10 minutes of calf and hip mobility.', 'Protein with your next meal.', 'Note any sore spot in the log (side, rating 0–10).'],
    wrong: ['A sharp or one-sided pain: stop, walk home, and skip the next run.', 'Heavy legs but no pain: finish as walking.'],
  },
  recovery: {
    feel: 'RPE 1–2. A walk or an easy spin, nothing that raises your breathing.',
    before: ['No preparation. Wear comfortable shoes.'],
    during: ['Keep it conversational and flat.', 'Any walk counts. Leave the phone in the pocket.'],
    after: ['Drink water, eat a proper meal.', 'Go to bed 30 minutes earlier tonight if you can; sleep is the strongest recovery tool.'],
    wrong: ['Feel flat or tired: shorten it. The benefit comes from moving, not from the minutes.'],
  },
  easy_run: {
    feel: 'RPE 3 of 10. You can speak full sentences. Heart rate stays under 150 and is usually 132–145.',
    before: ['Eat a small carbohydrate snack 60–90 minutes before if you run in the morning.', 'Drink a glass of water. Dress for 5 °C warmer than the thermometer says.', 'Start with 5 minutes of walking or very slow jogging.'],
    during: ['Keep the pace slower than feels necessary for the first 10 minutes.', 'Heart rate rises 5–10 beats over a run even at constant pace; that is normal, but if it crosses 150 slow down or walk 30 seconds.', 'Look after your form: tall, relaxed shoulders, quick light steps (about 170–180 per minute).', 'Strides, if listed: 20 seconds fast but relaxed, walk back, full recovery between.'],
    after: ['5 minutes walk, then calves and hips.', 'Eat within an hour; protein plus carbohydrate.', 'Rate the run in the log: RPE and how the legs felt.'],
    wrong: ['Heart rate high at an easy pace: poor sleep, heat or stress. Slow down and accept the slower pace.', 'Legs dead from the first step: do half the distance and log it.'],
  },
  long_run: {
    feel: 'RPE 3–4. The last third feels like work, but you could add a few more kilometres.',
    before: ['The evening before: normal dinner with extra carbohydrate, a glass of water, early night.', 'Breakfast 2–3 hours before: 60–80 g carbohydrate (toast, oats, banana).', 'Plan the route as a loop you can cut short.'],
    during: ['First 3 km very easy. Resist the first fast kilometres.', 'Heart rate under 150. If it drifts up after 90 minutes, slow down, do not try to hold pace.', `From about 16 km: take a ${GEL} every 40 minutes with water. Practising this now is what makes race-day fuelling work (Costa 2017).`, 'Drink to thirst; carry a bottle for runs beyond 90 minutes.'],
    after: ['5 minutes walk. Eat within 30 minutes: carbohydrate and protein.', 'Easy day tomorrow (Monday): legs are heavy, which is normal.', 'Log distance, fuelling and how the last 3 km felt.'],
    wrong: ['Stomach trouble after a gel: halve the dose next time and take it with more water.', 'Hip or knee pain: stop at the next safe spot. Do not finish the planned distance at any cost.'],
  },
  long_pace: {
    feel: 'RPE 3–4 for the easy kilometres, 5–6 for the steady kilometres. Controlled, never a race.',
    before: ['Same carbohydrate loading as for a normal long run.', 'Know where the steady section starts on your route.'],
    during: ['Easy kilometres stay under 150 bpm.', 'The steady section is a progression: start at the slow end of the target and finish at the fast end.', 'Heart rate may reach 155–160 on the steady kilometres; that is expected.', `Fuel with a ${GEL} every 40 minutes, as practised.`],
    after: ['Walk 5 minutes, eat within 30 minutes.', 'Tomorrow is a rest or recovery day; do not skip it.'],
    wrong: ['Cannot hold the steady pace at an easy-feeling effort: drop to easy running for the rest. The session stays valuable.'],
  },
  speed: {
    feel: 'RPE 8 for the reps, 2 between them. Fast but relaxed. You finish thinking you could do 2 more.',
    before: ['Easy eating, nothing heavy for 2 hours before.', 'Warm up fully: 15 minutes easy, drills, 3 strides. Cold legs are what injure people on speed days.', 'Know the exact rep distance; use a track, a flat road with markers or the watch lap button.'],
    during: ['Aim for equal rep times; the last rep should match the first.', 'Run tall. Quick feet, relaxed hands and face.', 'Recovery jog is slow. Do not stand still.'],
    after: ['10 minutes easy jog, then walk.', 'Log the rep splits; the trend is the motivating part.'],
    wrong: ['First rep slower than target: do not chase it. Run the target for the rest or stop at 4 reps.', 'Tight hamstring or calf: stop. Speed work on a strain is how a season ends.'],
  },
  vo2: {
    feel: 'RPE 8–9 on the reps. Hard and controlled, breathing heavy by the third rep.',
    before: ['Eat a normal meal 2–3 hours before, no heavy foods.', '15 minutes easy jog, drills, 3 strides.', 'Check your readiness first: if the app shows yellow, the session turns into a steady Z2 run. That is the plan working, not failing.'],
    during: ['Start at the slow end of the rep pace. Reps 4 and 5 should feel hard but controlled, not like survival.', 'The jog recovery is slow and short of walking; keep moving.', 'Heart rate lags by 30–60 seconds; use pace for pacing and heart rate to confirm.'],
    after: ['10 minutes easy jog and walk.', 'Eat protein and carbohydrate within an hour.', 'Log the splits and RPE.'],
    wrong: ['Cannot reach target pace by rep 2: the day is wrong, not you. Convert to steady running at the same total time.', 'Pain rather than effort: stop.'],
  },
  threshold: {
    feel: 'RPE 6–7. Comfortably hard: you could say a few words but not hold a conversation.',
    before: ['Normal meal 2–3 hours before.', '15 minutes easy, drills and strides.'],
    during: ['Pace first, heart rate second. Heart rate drifts up during each rep and settles near 165–172 (your lactate-threshold heart rate is 172).', 'Equal splits across reps.', 'Jog the recoveries slowly.'],
    after: ['10 minutes easy, walk, eat.', 'Thursday is the strength day, so tomorrow has no other training.'],
    wrong: ['Heart rate above 175 at the target pace: slow by 5 seconds per kilometre. The target is a range, not a dare.'],
  },
  swim_tech: {
    feel: 'RPE 3–4. Smooth and long, not fast. If you are out of breath you are going too fast.',
    before: ['Light snack 60 minutes before. Bring a pace clock or use the watch.', 'Count strokes per length on the first easy 100 so you have a reference.'],
    during: ['Drills are for feel: slow, exaggerated, with full rotation.', 'Finish with whole-stroke swimming; stop a drill when the form fades.', 'Count strokes per 25 m on the swim sets; fewer strokes at the same effort is the goal.'],
    after: ['Dry off and eat; the swim makes you hungrier than you expect.', 'Write the stroke count in the log. It is your progress measure until the first test.'],
    wrong: ['Arms heavy after a long break: shorten to the warm-up and one drill set. You have not swum since July; the first sessions are for coming back.'],
  },
  swim_endu: {
    feel: 'RPE 4–5. Steady and relaxed; you could talk at the wall.',
    before: ['Light snack. Stretch shoulders for 2 minutes.'],
    during: ['The continuous swim is the main set: no wall rests. Breathe every 3 strokes if you can, every 2 if you must.', 'Aim for even 100 m splits. Slower is fine, uneven is not.'],
    after: ['Easy 100 m, dry off, eat.', 'Log the distance and your average 100 m time.'],
    wrong: ['Cannot swim the full distance non-stop: split it into two blocks with 20 seconds rest and log that. Next week try again.'],
  },
  bike: {
    feel: 'RPE 3–4. Easy aerobic riding. Breathing is steady, legs spin lightly.',
    before: ['Set up the indoor bike: fan on, bottle in reach, saddle at the same height as always.', 'Light snack if it is after a run day.'],
    during: ['Cadence 85–95 rpm, smooth circles. Cadence rides alternate 2 minutes high (100–110) with 2 minutes normal.', 'Hips quiet. No bouncing.', 'Power or heart rate stays in the easy zone; the FTP number is provisional until Checkpoint 1.'],
    after: ['5 minutes easy spin, stretch hip flexors.', 'Log cadence feel and any saddle discomfort.'],
    wrong: ['Knee pain: check saddle height before you check your fitness.'],
  },
  bike_hard: {
    feel: 'RPE 6–7. Sweet-spot work is hard to sustain but not a sprint.',
    before: ['Full warm-up: 10 minutes easy with 3 spin-ups.', 'Eat a normal meal 2 hours before.'],
    during: ['Hold the target watts or RPE; do not start above it.', 'Between efforts spin easy; do not coast.'],
    after: ['5 minutes easy spin.', 'Log average power and RPE; compare week to week.'],
    wrong: ['Cannot hold the target by the third effort: finish the set at 5% lower. Provisional watts may be too high until Checkpoint 1.'],
  },
  strength_return: {
    feel: 'RPE 5–6. Light and smooth, 3 reps in reserve. You should not feel sore tomorrow.',
    before: ['Light snack 90 minutes before.', 'Evening sessions work well after a day of easy running.'],
    during: ['Upper body and trunk only: no leg work in the first week after the marathon.', 'Tick the set dots as you go.'],
    after: ['Stretch chest and hip flexors for 3 minutes.', 'Enter your weights and reps in the log.'],
    wrong: ['Shoulder pain on pressing: switch to a neutral grip or lower the angle; ask for form advice if it stays.'],
  },
  strength_anat: {
    feel: 'RPE 6–7. Moderate loads, 2–3 reps in reserve, slow lowering.',
    before: ['Light snack. Thursday has no other training, so train whenever suits you.', 'Warm up as printed: ramp-up sets at 50% and 75% of working weight.'],
    during: ['Lower for 3 seconds on the leg lifts. Stop each set with 2–3 reps left.', 'Rest 90 seconds between sets; use the time to breathe, not the phone.', 'Tick the dots after each set.'],
    after: ['Stretch hip flexors and calves.', 'Write down weight and reps for the last set of each lift; the next session sets the load from them.'],
    wrong: ['Knees or lower back complain: reduce range of motion, not the weight; if it stays, skip the exercise.'],
  },
  strength_heavy: {
    feel: 'RPE 8 on the last set of each lift, with 2 reps left in the tank. Slow lowering, controlled lift.',
    before: ['Thursday is its own day: no run, swim or ride around it. Any time that suits you.', 'Eat 90 minutes before.', 'Ramp-up sets at 50% and 75% of the working weight.'],
    during: ['3 seconds down, 1 second pause, lift. This is what makes the load heavy with 25 kg dumbbells.', 'Rest 2 minutes after leg lifts. Short rests defeat the purpose.', 'When a set hits the top of the rep range with 2 reps left, add weight next time; the app suggests it from your log.'],
    after: ['Walk it off for 5 minutes, stretch calves and hips.', 'Eat protein within 90 minutes.', 'Log the weights and reps so the next session is set correctly.'],
    wrong: ['Cannot reach the minimum reps: lower the load 5–10% and log it. Missing reps is information, not failure.', 'Soreness above 5 of 10 the next morning: reduce one set on each lift next time.'],
  },
  strength_taper: {
    feel: 'RPE 6. Same loads, fewer sets. You should feel fresh afterwards.',
    before: ['Keep to the same time of day as usual.'],
    during: ['Two sets per lift, stop with 3 reps left.', 'No jumps in the final week before a race.'],
    after: ['Stretch, eat, sleep.'],
    wrong: ['Feeling slow before the race is normal. Do not add sets to feel better.'],
  },
};

const CP = {
  1: { feel: 'A maximum-effort swim test on Monday and an all-out bike test on Tuesday, one session each day. Hard, short, controlled.',
    before: ['Rest the day before: no hard session.', 'Eat well and sleep; this is a test of fitness, not tiredness.', 'The swim is on 28 Dec and the bike test on 29 Dec, one a day.'],
    during: ['Swim: 400 m time trial, 10 minutes easy, then 200 m time trial. Even pacing; do not sprint the first 100.', 'Bike: 20 minutes as hard as you can sustain evenly. Start at 90% of your effort and build.', 'Record strokes per 25 m in the last 100 of each swim.'],
    after: ['Enter times and power in the Progress tab: the app recalculates your swim pace and FTP.', 'Easy day next. You will feel flat; that is normal.'],
    wrong: ['If the app shows yellow or red in the morning, the test is deferred up to 48 hours.', 'No power meter: log the 20-minute average heart rate instead and use effort-based zones.'] },
  2: { feel: 'A 5K time trial: hard from 1 km, controlled from 2 to 4 km, empty by the end.',
    before: ['Easy day before. Carbohydrate-rich dinner.', 'Flat route or track.', 'Warm-up: 15 minutes easy, drills, 4 strides, 3 minutes at 10K pace, 3 minutes rest.'],
    during: ['First kilometre 5 seconds slower than target; build into the target pace.', 'Heart rate climbs steadily; that is normal. Use pace and feel.'],
    after: ['10 minutes easy jog. Log time, average heart rate, max heart rate.', 'The result re-scales every pace in the programme. Mažeikiai race pace is set from this.'],
    wrong: ['Cannot go faster than easy pace: tired or unwell. Defer 48 hours, never test while ill.'] },
};

const RACE = {
  feel: 'RPE 8–9 from kilometre 3. Controlled start, hard finish.',
  before: ['Eat what you have practised: carbohydrate-rich dinner two nights before; same breakfast as your long runs.', 'Lay out kit the night before; test-run nothing new.', 'Warm-up: 15 minutes easy jog, drills, 4 strides, finish 10 minutes before the gun.'],
  during: ['First 3 km at goal pace or 3 seconds slower. Do not go out fast.', 'Km 4–7 hold rhythm. Final 3 km empty the tank.', 'Take water at aid stations only if you need it for a 10K.'],
  after: ['10 minutes easy jog and walk, eat and drink within 30 minutes.', 'Rest the day after; no training.', 'Log your time and splits: they feed the next quarter.'],
  wrong: ['Feeling ill on race morning: the app never cancels a race, but skipping is a valid call.', 'Hot or windy day: adjust the target pace by 5–10 seconds per kilometre, not your effort.'],
};

export function sessionBrief(s) {
  if (!s || s.group === 'rest' && s.kind === 'rest') return null;
  if (s.group === 'race') return RACE;
  if (s.group === 'checkpoint') return CP[s.checkpoint] || null;
  return B[s.why] || null;
}
