import Nav from "./components/Nav.jsx";
import Hero from "./components/Hero.jsx";
import Marquee from "./components/Marquee.jsx";
import Idea from "./components/Idea.jsx";
import Surfaces from "./components/Surfaces.jsx";
import Features from "./components/Features.jsx";
import HowItWorks from "./components/HowItWorks.jsx";
import Stats from "./components/Stats.jsx";
import Gallery from "./components/Gallery.jsx";
import Setup from "./components/Setup.jsx";
import CTA from "./components/CTA.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Idea />
        <Surfaces />
        <Features />
        <HowItWorks />
        <Stats />
        <Gallery />
        <Setup />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
