export interface StorefrontSection {
  id: string;
  type: 'hero' | 'about' | 'programs' | 'services' | 'testimonials' | 'other_coaches' | 'faq' | 'contact';
  title: string;
  visible: boolean;
  order: number;
}

export interface Testimonial {
  id: string;
  name: string;
  photo: string;
  initials: string;
  color: string;
  rating: number;
  text: string;
  program: string;
  date: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export const DEFAULT_SECTIONS: StorefrontSection[] = [
  { id: 's-hero', type: 'hero', title: 'Hero Banner', visible: true, order: 1 },
  { id: 's-about', type: 'about', title: 'About Coach', visible: true, order: 2 },
  { id: 's-programs', type: 'programs', title: 'Featured Programs', visible: true, order: 3 },
  { id: 's-services', type: 'services', title: 'Services & Pricing', visible: true, order: 4 },
  { id: 's-testimonials', type: 'testimonials', title: 'Testimonials', visible: true, order: 5 },
  { id: 's-coaches', type: 'other_coaches', title: 'Collaborating Coaches', visible: false, order: 6 },
  { id: 's-faq', type: 'faq', title: 'FAQ', visible: true, order: 7 },
  { id: 's-contact', type: 'contact', title: 'Contact', visible: true, order: 8 },
];

export const DEFAULT_TESTIMONIALS: Testimonial[] = [
  { id: 't-1', name: 'Arjun Mehta', photo: '', initials: 'AM', color: 'bg-blue-500', rating: 5, text: 'Dr. Radha\'s program completely transformed my health. Lost 8 kgs in 3 months and my blood sugar is now under control. Her personalized approach made all the difference!', program: 'Weight Loss Intensive', date: 'March 2026' },
  { id: 't-2', name: 'Priya Sharma', photo: '', initials: 'PS', color: 'bg-pink-500', rating: 5, text: 'After struggling with PCOS for 4 years, I finally found real solutions. My cycles are regular for the first time in years. Cannot recommend this program enough!', program: 'PCOS Reversal Program', date: 'April 2026' },
  { id: 't-3', name: 'Rohan Gupta', photo: '', initials: 'RG', color: 'bg-cyan-500', rating: 5, text: 'As an athlete, I needed specific nutrition guidance. The Athletic Performance program gave me exactly that. My performance has improved significantly.', program: 'Athletic Performance', date: 'February 2026' },
  { id: 't-4', name: 'Lakshmi Rao', photo: '', initials: 'LR', color: 'bg-rose-500', rating: 4, text: 'At 55, I did not think I could improve my bone health. The Senior Wellness Program proved me wrong. My doctor is impressed with the improvements!', program: 'Senior Wellness Program', date: 'March 2026' },
  { id: 't-5', name: 'Kavitha Nambiar', photo: '', initials: 'KN', color: 'bg-fuchsia-500', rating: 5, text: 'Not only did my PCOS symptoms improve, my skin cleared up too! The anti-inflammatory approach is truly holistic.', program: 'PCOS Reversal Program', date: 'April 2026' },
];

export const DEFAULT_FAQS: FAQ[] = [
  { id: 'f-1', question: 'How does the consultation process work?', answer: 'After enrollment, you will have an initial consultation call with Dr. Radha to understand your health goals, medical history, and dietary preferences. Based on this, a personalized diet chart and program plan will be created for you within 48 hours.' },
  { id: 'f-2', question: 'Can I change my diet chart if I do not like certain foods?', answer: 'Absolutely! Your diet charts are fully customizable based on your food preferences, cultural traditions, and any food restrictions. Simply message your coach or nutritionist and changes will be made within 24 hours.' },
  { id: 'f-3', question: 'How often will I have check-ins with the coach?', answer: 'We recommend weekly check-ins to track progress. You will have a dedicated weekly check-in form to fill, and monthly 1:1 video calls with Dr. Radha. You can message anytime through the platform.' },
  { id: 'f-4', question: 'Do you cater to vegetarians and vegans?', answer: 'Yes! We specialize in vegetarian, vegan, and plant-based diets alongside non-vegetarian programs. All diet charts are created with your dietary preference as the primary filter.' },
  { id: 'f-5', question: 'What happens if I miss a day on my diet?', answer: 'Health is a journey, not a destination! Missing one day is completely normal. We focus on consistency over perfection — an 80% adherence rate is already excellent progress.' },
  { id: 'f-6', question: 'Do I need to buy supplements?', answer: 'Supplements are recommended only when there is a clear deficiency (like iron, vitamin D, or B12). They are never mandatory — we always prioritize food-first approaches.' },
  { id: 'f-7', question: 'Is my health data kept confidential?', answer: 'Yes, completely. All health data is stored securely and is DPDP Act 2023 compliant. Your data is never shared with third parties without explicit consent.' },
];
