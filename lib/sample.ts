export type Job = {
  id: string;
  title: string;
  company: string;
  business_id?: string;
  location: string;
  employment_type: string;
  arrangement: string;
  salary_min: number | null;
  salary_max: number | null;
  category: string;
  description: string;
  responsibilities?: string;
  qualifications?: string;
  created_at: string;
  deadline?: string;
  status?: string;
  saved?: boolean;
};
export const sampleJobs: Job[] = [
  {
    id: "sample-1",
    title: "Administrative Assistant",
    company: "Candelaria Community Co.",
    location: "Poblacion, Candelaria",
    employment_type: "Full-time",
    arrangement: "On-site",
    salary_min: 15000,
    salary_max: 18000,
    category: "Administration",
    description:
      "Help a growing local team stay organized. Coordinate daily operations, maintain records, and provide a welcoming experience for our customers. We value attention to detail, clear communication, and a willingness to learn. Fresh graduates are welcome to explore this sample role.",
    created_at: "2026-10-22",
  },
  {
    id: "sample-2",
    title: "Barista / Café Team Member",
    company: "Café Luntian",
    location: "Candelaria, Quezon",
    employment_type: "Full-time",
    arrangement: "On-site",
    salary_min: 13000,
    salary_max: 16000,
    category: "Food & hospitality",
    description:
      "Bring warmth to every cup. Prepare beverages, welcome customers, and work with a supportive café team. A friendly attitude and an interest in learning matter most.",
    created_at: "2026-10-22",
  },
  {
    id: "sample-3",
    title: "Social Media Associate",
    company: "Southside Creative",
    location: "Candelaria, Quezon",
    employment_type: "Part-time",
    arrangement: "Hybrid",
    salary_min: 12000,
    salary_max: 18000,
    category: "Marketing & creative",
    description:
      "Help local brands tell their stories. Create engaging content, plan social calendars, and support community campaigns. Share your portfolio and your ideas.",
    created_at: "2026-10-21",
  },
  {
    id: "sample-4",
    title: "Sales & Retail Associate",
    company: "Likha Local",
    location: "Poblacion, Candelaria",
    employment_type: "Full-time",
    arrangement: "On-site",
    salary_min: 14000,
    salary_max: 17000,
    category: "Sales & retail",
    description:
      "Connect shoppers with thoughtfully crafted local products. Support store operations, manage displays, and deliver thoughtful customer service.",
    created_at: "2026-10-21",
  },
  {
    id: "sample-5",
    title: "Junior Accounting Assistant",
    company: "Quezon Business Solutions",
    location: "Candelaria, Quezon",
    employment_type: "Full-time",
    arrangement: "On-site",
    salary_min: 16000,
    salary_max: 20000,
    category: "Finance & accounting",
    description:
      "Build your accounting career close to home. Assist with bookkeeping, reconciliations, and financial records. Relevant education and careful attention to detail are appreciated.",
    created_at: "2026-10-20",
  },
  {
    id: "sample-6",
    title: "Customer Support Specialist",
    company: "Connective Services",
    location: "Candelaria, Quezon",
    employment_type: "Full-time",
    arrangement: "Remote",
    salary_min: 18000,
    salary_max: 24000,
    category: "Customer service",
    description:
      "Make every interaction count. Answer customer inquiries, solve problems, and share helpful feedback with our team. Strong communication skills and a reliable internet connection are essential.",
    created_at: "2026-10-20",
  },
];
