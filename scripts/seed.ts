import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { UserModel } from '../src/models/User.model';
import { RecruiterProfileModel } from '../src/models/RecruiterProfile.model';
import { ApplicantProfileModel } from '../src/models/ApplicantProfile.model';
import { JobModel } from '../src/models/Job.model';
import { ApplicationModel } from '../src/models/Application.model';
import { ScreeningSnapshotModel } from '../src/models/ScreeningSnapshot.model';
import { DecisionSessionModel } from '../src/models/DecisionSession.model';

const MONGO_URI = process.env.MONGODB_URI!;

const LOCATIONS = ['Kigali, Rwanda', 'Nairobi, Kenya', 'Lagos, Nigeria', 'Accra, Ghana', 'Kampala, Uganda', 'Dakar, Senegal', 'Cairo, Egypt', 'Cape Town, South Africa', 'Addis Ababa, Ethiopia', 'Dar es Salaam, Tanzania'];
const SKILLS_POOL = ['Node.js', 'TypeScript', 'React', 'Python', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS', 'GraphQL', 'Redis', 'TensorFlow', 'PyTorch', 'Kubernetes', 'Go', 'Java', 'Vue.js', 'Next.js', 'FastAPI', 'Elasticsearch', 'CI/CD'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'] as string[];
const AVAIL_TYPES = ['Full-time', 'Part-time', 'Contract'] as string[];
const AVAIL_STATUS = ['Available', 'Open to Opportunities', 'Not Available'] as string[];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] { return [...arr].sort(() => Math.random() - 0.5).slice(0, n); }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear existing seed data
  await Promise.all([
    UserModel.deleteMany({ email: { $in: ['recruiter@umurava.africa', 'admin@umurava.africa'] } }),
    RecruiterProfileModel.deleteMany({}),
  ]);

  // ── Recruiter accounts ────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Demo1234!', 10);
  const recruiter = await UserModel.create({ email: 'recruiter@umurava.africa', passwordHash: hash, role: 'recruiter', fullName: 'Belyse Uwimana', phoneNumber: '+250788000001', isActive: true, emailVerified: true });
  const admin = await UserModel.create({ email: 'admin@umurava.africa', passwordHash: hash, role: 'admin', fullName: 'Admin User', phoneNumber: '+250788000002', isActive: true, emailVerified: true });
  const recruiterProfile = await RecruiterProfileModel.create({ user: recruiter._id, companyName: 'Umurava' });
  console.log('✓ Recruiter accounts created');

  // ── 35 Candidates ─────────────────────────────────────────────────────────
  const candidateNames = [
    'Amara Uwimana', 'Jean Nshimiyimana', 'Marie Hakizimana', 'David Okonkwo', 'Fatima Al-Hassan',
    'Kwame Mensah', 'Aisha Diallo', 'Samuel Mwangi', 'Grace Nakamura', 'Ibrahim Traore',
    'Priya Sharma', 'Carlos Mendez', 'Yuki Tanaka', 'Oluwaseun Adeyemi', 'Zara Ahmed',
    'Tina Dlamini', 'Felix Osei', 'Nadia Benali', 'Emmanuel Kiptoo', 'Sophia Andersen',
    'Kofi Asante', 'Leila Mansouri', 'Patrick Nkurunziza', 'Amina Coulibaly', 'Victor Oduya',
    'Hana Gebre', 'Rashid Al-Farsi', 'Chioma Eze', 'Tendai Moyo', 'Yaw Darko',
    'Fatou Diop', 'Abebe Girma', 'Nkechi Okafor', 'Moussa Keita', 'Zanele Dube',
  ];

  const candidateUsers = [];
  const candidateProfiles = [];

  for (let i = 0; i < 35; i++) {
    const name = candidateNames[i];
    const [firstName, ...rest] = name.split(' ');
    const lastName = rest.join(' ');
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}@example.com`;
    const yoe = randInt(0, 15);
    const skills = pickN(SKILLS_POOL, randInt(3, 8)).map((s) => ({ name: s, level: pick(LEVELS), yearsOfExperience: randInt(0, Math.min(yoe, 8)) }));
    const completeness = Math.min(100, 40 + skills.length * 5 + (yoe > 2 ? 20 : 0) + randInt(0, 20));

    const user = await UserModel.create({ email, passwordHash: hash, role: 'applicant', fullName: name, isActive: true, emailVerified: true });
    const profile = await ApplicantProfileModel.create({
      user: user._id, firstName, lastName, email,
      headline: `${pick(['Senior', 'Mid-level', 'Junior', 'Lead'])} ${pick(['Backend', 'Frontend', 'Full-stack', 'ML', 'DevOps'])} Engineer`,
      location: pick(LOCATIONS),
      skills,
      experience: yoe > 0 ? [{ company: pick(['Andela', 'Flutterwave', 'Paystack', 'Safaricom', 'MTN', 'Jumia', 'Interswitch']), role: `${pick(['Software', 'Backend', 'Frontend'])} Engineer`, startDate: `${2024 - yoe}-01`, endDate: 'Present', description: `Built scalable systems using ${skills.slice(0, 2).map(s => s.name).join(' and ')}.`, technologies: skills.slice(0, 3).map(s => s.name), isCurrent: true }] : [],
      education: [{ institution: pick(['University of Rwanda', 'University of Nairobi', 'University of Lagos', 'KNUST', 'Makerere University']), degree: "Bachelor's", fieldOfStudy: pick(['Computer Science', 'Software Engineering', 'Information Technology']), startYear: 2024 - yoe - 4, endYear: 2024 - yoe }],
      availability: { status: pick(AVAIL_STATUS), type: pick(AVAIL_TYPES) },
      source: i < 10 ? 'umurava' : 'external',
      profileCompleteness: completeness,
    });
    candidateUsers.push(user);
    candidateProfiles.push(profile);
  }
  console.log('✓ 35 candidates created');

  // ── 3 Jobs ────────────────────────────────────────────────────────────────
  const job1 = await JobModel.create({ recruiter: recruiterProfile._id, title: 'Senior Backend Engineer', description: 'Build scalable APIs and microservices for our fintech platform. You will own backend architecture decisions and mentor junior engineers.', requiredSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Docker'], niceToHaveSkills: ['Kubernetes', 'Redis'], minYearsExperience: 5, requiresDegree: true, degreeDetails: "Bachelor's", location: 'Kigali, Rwanda', isRemote: true, employmentType: 'Full-time', status: 'active', screeningBatchSize: 10, aiAssisted: true });
  const job2 = await JobModel.create({ recruiter: recruiterProfile._id, title: 'AI/ML Engineer', description: 'Design and deploy machine learning models for our recommendation engine. Experience with LLMs and production ML systems required.', requiredSkills: ['Python', 'TensorFlow', 'PyTorch'], niceToHaveSkills: ['AWS', 'Docker'], minYearsExperience: 3, requiresDegree: true, degreeDetails: "Master's", location: 'Nairobi, Kenya', isRemote: false, employmentType: 'Full-time', status: 'active', screeningBatchSize: 10, aiAssisted: true });
  const job3 = await JobModel.create({ recruiter: recruiterProfile._id, title: 'Frontend Engineer', description: 'Build beautiful, accessible user interfaces for our consumer-facing products. Strong React and TypeScript skills required.', requiredSkills: ['React', 'TypeScript', 'Next.js'], niceToHaveSkills: ['GraphQL', 'Tailwind CSS'], minYearsExperience: 2, requiresDegree: false, location: 'Lagos, Nigeria', isRemote: false, employmentType: 'Full-time', status: 'active', screeningBatchSize: 20, aiAssisted: true });
  console.log('✓ 3 jobs created');

  // ── Applications for Job 1 (first 15 candidates) ──────────────────────────
  const job1Apps: any[] = [];
  for (let i = 0; i < 15; i++) {
    const app = await ApplicationModel.create({ job: job1._id, applicant: candidateProfiles[i]._id, status: 'submitted', submittedAt: new Date() });
    job1Apps.push(app);
  }

  // ── Pre-seeded screening snapshot for Job 1 ───────────────────────────────
  const shortlist = candidateProfiles.slice(0, 10).map((p, idx) => ({
    applicationId: job1Apps[idx]._id.toString(),
    name: candidateNames[idx],
    rank: idx + 1,
    score: Math.max(45, 95 - idx * 5 + randInt(-3, 3)),
    strengths: [`Strong ${p.skills[0]?.name || 'Node.js'} expertise`, `${randInt(3, 8)} years relevant experience`, 'Excellent problem-solving skills'],
    gaps: [`Limited ${pick(['AWS', 'Kubernetes', 'Redis'])} experience`, idx > 5 ? 'Below minimum experience threshold' : 'No formal leadership experience'],
    reason: `${candidateNames[idx]} demonstrates strong technical skills with ${p.skills[0]?.name || 'Node.js'} and has ${p.experience[0] ? 'relevant industry experience' : 'strong academic background'}. ${idx < 3 ? 'Highly recommended for interview.' : 'Worth considering for the role.'}`,
    recommendation: idx < 3 ? 'Shortlist' : idx < 7 ? 'Consider' : 'Not selected',
  }));

  const snapshot = await ScreeningSnapshotModel.create({
    jobId: job1._id,
    screeningRun: new mongoose.Types.ObjectId(),
    results: shortlist,
    decisions: Object.fromEntries(shortlist.slice(0, 5).map((r, i) => [r.applicationId, { decision: i < 3 ? 'approved' : 'rejected', decidedAt: new Date(), decidedBy: recruiter._id.toString() }])),
    finalized: true,
    finalizedAt: new Date(),
    finalizedBy: recruiter._id.toString(),
    finalSummary: `Excellent screening session for the Senior Backend Engineer role. **${candidateNames[0]}** leads with a 95% match score, bringing exceptional Node.js and TypeScript depth. **${candidateNames[1]}** and **${candidateNames[2]}** round out the approved shortlist with strong backend fundamentals. The two rejected candidates showed promise but fell short on the minimum experience requirement. I recommend scheduling interviews with the three approved candidates this week.`,
  });

  // ── Pre-seeded DecisionSession for Job 1 ─────────────────────────────────
  await DecisionSessionModel.create({
    jobId: job1._id,
    recruiterId: recruiter._id.toString(),
    status: 'finalised',
    startedAt: new Date(Date.now() - 3600000),
    finalisedAt: new Date(),
    candidates: shortlist.map((r) => ({ candidateId: r.applicationId, name: r.name, rank: r.rank, overallScore: r.score, subscores: { skills: r.score + 2, experience: r.score - 3, education: r.score + 1, projects: r.score - 5, availability: 100 }, strengths: r.strengths, gaps: r.gaps, recommendation: r.recommendation })),
    thumbsLog: shortlist.slice(0, 5).map((r, i) => ({ candidateId: r.applicationId, signal: i < 3 ? 'up' : 'down', timestamp: new Date(Date.now() - (5 - i) * 300000) })),
    messages: [
      { _id: new mongoose.Types.ObjectId().toString(), role: 'ai', content: `Welcome! I've screened 15 candidates for the **Senior Backend Engineer** role and shortlisted the top 10. **${candidateNames[0]}** leads with a 95% match score — exceptional Node.js and TypeScript depth. Scores range from 95% down to 50%. I notice a strong cluster of Rwandan and Kenyan candidates. Ready to start reviewing? I'd suggest beginning with ${candidateNames[0]} at the top.`, timestamp: new Date(Date.now() - 3500000), triggeredBy: 'session_start' },
      { _id: new mongoose.Types.ObjectId().toString(), role: 'recruiter', content: `👍 ${candidateNames[0]}`, timestamp: new Date(Date.now() - 3000000) },
      { _id: new mongoose.Types.ObjectId().toString(), role: 'ai', content: `Great instinct — ${candidateNames[0]}'s Node.js expertise is genuinely impressive, and their 7 years of experience sets a high bar for the rest of the shortlist. They're ahead of ${candidateNames[1]} in raw experience but both are strong. Want to move to ${candidateNames[1]} next?`, timestamp: new Date(Date.now() - 2900000), triggeredBy: 'thumbs_up' },
      { _id: new mongoose.Types.ObjectId().toString(), role: 'recruiter', content: `👍 ${candidateNames[1]}`, timestamp: new Date(Date.now() - 2400000) },
      { _id: new mongoose.Types.ObjectId().toString(), role: 'ai', content: `${candidateNames[1]} is a solid choice — their full-stack background complements ${candidateNames[0]}'s pure backend focus nicely. You've now approved two candidates with 5+ years experience, which suggests experience level is important to you. ${candidateNames[2]} also clears that bar. Shall we continue?`, timestamp: new Date(Date.now() - 2300000), triggeredBy: 'thumbs_up' },
    ],
    finalDecisions: shortlist.slice(0, 5).map((r, i) => ({ candidateId: r.applicationId, decision: i < 3 ? 'approved' : 'rejected', justification: i < 3 ? `Strong ${r.strengths[0]} with proven track record` : `Primary gap: ${r.gaps[0]}`, approvedBy: 'Belyse Uwimana', timestamp: new Date() })),
    pdfReport: { generatedAt: new Date(), downloadUrl: `/api/sessions/demo/report`, summary: `3 candidates approved for Senior Backend Engineer role.` },
  });

  console.log('✓ Pre-seeded screening + decision session for Job 1');
  console.log('\n🎉 Seed complete!');
  console.log('   recruiter@umurava.africa / Demo1234!');
  console.log('   admin@umurava.africa / Demo1234!');
  console.log(`   Job 1 (${job1._id}) has a completed screening + finalised session`);

  await mongoose.disconnect();
}

seed().catch((err) => { console.error('Seed failed:', err); process.exit(1); });
