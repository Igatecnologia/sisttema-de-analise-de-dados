import { Nav } from '@/components/Nav'
import { Hero } from '@/components/sections/Hero'
import { Problem } from '@/components/sections/Problem'
import { Features } from '@/components/sections/Features'
import { HowItWorks } from '@/components/sections/HowItWorks'
import { Integrations } from '@/components/sections/Integrations'
import { Segments } from '@/components/sections/Segments'
import { Security } from '@/components/sections/Security'
import { Pricing } from '@/components/sections/Pricing'
import { SocialProof } from '@/components/sections/SocialProof'
import { Faq } from '@/components/sections/Faq'
import { BetaInvite } from '@/components/sections/BetaInvite'
import { Footer } from '@/components/sections/Footer'

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Integrations />
        <Segments />
        <Security />
        <Pricing />
        <SocialProof />
        <Faq />
        <BetaInvite />
      </main>
      <Footer />
    </>
  )
}
