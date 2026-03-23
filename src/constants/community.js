const now = Date.now()

export const SEED_POSTS = []

export const SEED_GROUPS = [
  { id:"sg1",  name:"UK & Ireland Freelancers",     description:"Leads, wins, and local tips for freelancers across the UK and Ireland",            ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--blue)",   createdAt:now-86400000*90 },
  { id:"sg2",  name:"SEO Agency Owners",             description:"Strategy, tools, and lead-sharing for SEO specialists and small agencies",          ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--green)",  createdAt:now-86400000*85 },
  { id:"sg3",  name:"Web Designers Network",         description:"Share web design leads, templates, pricing strategies, and client wins",            ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--lime)",   createdAt:now-86400000*80 },
  { id:"sg4",  name:"Cold Email & Outreach Lab",     description:"Templates, deliverability tips, and reply-rate experiments. No fluff.",             ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--amber)",  createdAt:now-86400000*75 },
  { id:"sg5",  name:"North America Hustlers",        description:"US and Canada freelancers sharing leads, rates, and regional opportunities",        ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--red)",    createdAt:now-86400000*70 },
  { id:"sg6",  name:"Africa & Middle East Network",  description:"West Africa, East Africa, North Africa, UAE, Saudi — connect and find clients",     ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--teal)",   createdAt:now-86400000*65 },
  { id:"sg7",  name:"Social Media Agency Owners",    description:"Growing a social media management agency? Share packages, pricing, and wins here",  ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--purple)", createdAt:now-86400000*60 },
  { id:"sg8",  name:"Google Ads & PPC Club",         description:"Running paid ads for clients? Compare results, niches, and rates with peers",       ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--blue)",   createdAt:now-86400000*55 },
  { id:"sg9",  name:"Asia-Pacific Freelancers",      description:"Philippines, Australia, India, Singapore, New Zealand — AP market insights",        ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--green)",  createdAt:now-86400000*50 },
  { id:"sg10", name:"First $1k/Month Club",          description:"If you're working towards your first $1k MRR, this is your accountability group",   ownerId:"system", ownerName:"Zenvylo", memberCount:0, private:false, color:"var(--amber)",  createdAt:now-86400000*45 },
]
