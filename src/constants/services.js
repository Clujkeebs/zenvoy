export const COUNTRIES = [
  "United States","United Kingdom","Canada","Australia","Ireland",
  "New Zealand","South Africa","India","Nigeria","Kenya",
  "Germany","France","Spain","Italy","Netherlands",
  "Brazil","Mexico","Argentina","Philippines","Singapore",
  "Malaysia","UAE","Saudi Arabia","Japan","South Korea",
  "Ghana","Pakistan","Bangladesh","Indonesia","Vietnam",
  "Poland","Portugal","Sweden","Norway","Denmark",
]

export const SERVICES = [
  { id:"web",     label:"Website Design / Rebuild",   icon:"globe",       problems:["No website","Outdated site","Not mobile-friendly","No SSL","Very slow loading"] },
  { id:"seo",     label:"SEO & Search Ranking",        icon:"trending",    problems:["No Google ranking","Missing meta tags","No blog","Slow page speed","No schema markup"] },
  { id:"social",  label:"Social Media Management",    icon:"users",       problems:["No social profiles","Inactive accounts","No engagement","Ignored reviews","No branding"] },
  { id:"phone",   label:"AI Phone / Receptionist",    icon:"phone",       problems:["No phone listed","No voicemail","Missed calls","No after-hours","No booking line"] },
  { id:"ads",     label:"Google / Meta Ads",           icon:"fire",        problems:["No ads running","Poor ad copy","Low review count","No landing page","No conversion tracking"] },
  { id:"rep",     label:"Reputation Management",      icon:"star",        problems:["Under 10 reviews","Rating below 3.5","Unanswered bad reviews","No review system","Old reviews only"] },
  { id:"email",   label:"Email Marketing",             icon:"mail",        problems:["No email list","No newsletter","No lead magnet","No follow-up sequence","No contact form"] },
  { id:"local",   label:"Local SEO / Google Maps",    icon:"map",         problems:["Incomplete GMB profile","No map listing","Missing business hours","No photos","Wrong NAP data"] },
  { id:"chat",    label:"Chatbot / Live Chat",         icon:"ai",          problems:["No chat widget","No instant response","No FAQ bot","No lead capture","No booking"] },
  { id:"content", label:"Content Marketing / Blog",   icon:"note",        problems:["No blog","No video content","No case studies","No testimonials","Thin copy"] },
  { id:"crm",     label:"CRM & Sales Automation",     icon:"briefcase",   problems:["No CRM system","Manual follow-ups","No pipeline","No email automation","Leads falling through"] },
  { id:"brand",   label:"Branding & Logo Design",     icon:"tag",         problems:["Outdated logo","Inconsistent branding","No brand guidelines","Poor visual identity","Generic imagery"] },
]

export const BTYPE = ["Restaurant","Dental Practice","Law Office","Real Estate Agency","Auto Repair Shop","Plumbing Company","Hair Salon","Fitness Gym","Chiropractic Clinic","Accounting Firm","HVAC Company","Pet Groomer","Roofing Contractor","Pharmacy","Landscaping Company","Photography Studio","Catering Company","Moving Company","Day Spa","Pediatric Clinic","Yoga Studio","Tutoring Center","Computer Repair","Florist","Bakery"]

export const STATUSES = ["new","contacted","interested","proposal sent","negotiating","won","lost","on hold"]

export const STATUS_COLORS = {
  new:"c-gray", contacted:"c-blue", interested:"c-lime",
  "proposal sent":"c-amber", negotiating:"c-purple",
  won:"c-green", lost:"c-red", "on hold":"c-gray",
}

export const CURRENCIES = [
  {code:"USD",symbol:"$",name:"US Dollar"},
  {code:"GBP",symbol:"£",name:"British Pound"},
  {code:"EUR",symbol:"€",name:"Euro"},
  {code:"AUD",symbol:"A$",name:"Australian Dollar"},
  {code:"CAD",symbol:"C$",name:"Canadian Dollar"},
  {code:"NGN",symbol:"₦",name:"Nigerian Naira"},
  {code:"INR",symbol:"₹",name:"Indian Rupee"},
  {code:"KES",symbol:"Ksh",name:"Kenyan Shilling"},
  {code:"ZAR",symbol:"R",name:"South African Rand"},
  {code:"GHS",symbol:"₵",name:"Ghanaian Cedi"},
  {code:"PKR",symbol:"₨",name:"Pakistani Rupee"},
  {code:"PHP",symbol:"₱",name:"Philippine Peso"},
  {code:"SGD",symbol:"S$",name:"Singapore Dollar"},
  {code:"AED",symbol:"د.إ",name:"UAE Dirham"},
]

export const getCurrSym = user => CURRENCIES.find(c => c.code === user?.currency)?.symbol || "$"
