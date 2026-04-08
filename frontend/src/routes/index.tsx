import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getValidAccessToken } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { BookOpen, ArrowRight, Sparkles, MessageCircle, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const token = await getValidAccessToken();
    if (token) throw redirect({ to: "/lessons" });
  },
  component: () => <MonoFunLanding />,
});

const words = ["skibidi", "rizz", "gyatt", "mid", "sus"];

function AlphaLingoWordmark() {
  return (
    <div className="mb-8 flex flex-col items-center gap-4 animate-fade-in-up">
      <div className="relative inline-flex justify-center">
        <div className="absolute inset-x-8 bottom-0 h-10 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative rounded-[2rem] border border-border/60 bg-card/90 px-6 py-5 shadow-2xl backdrop-blur-xl sm:px-10 sm:py-6">
          <span
            className="block bg-gradient-to-b from-chart-4 via-chart-5 to-primary bg-clip-text text-center font-black leading-[0.84] tracking-[-0.08em] text-transparent"
            style={{
              fontSize: "clamp(4rem, 14vw, 9rem)",
              WebkitTextStroke: "1.5px color-mix(in oklab, var(--primary) 22%, white)",
              textShadow: "0 6px 0 rgba(255, 250, 240, 0.75)",
            }}
          >
            AlphaLingo
          </span>
        </div>

        <div className="absolute -left-4 top-4 rounded-full border border-primary/15 bg-secondary/95 px-3 py-1 text-xs font-bold text-primary shadow-lg backdrop-blur-sm sm:-left-8 sm:px-4 sm:text-sm -rotate-12">
          slay
        </div>
        <div className="absolute -right-3 bottom-5 rounded-full border border-chart-5/20 bg-accent/90 px-3 py-1 text-xs font-bold text-foreground shadow-lg backdrop-blur-sm sm:-right-8 sm:px-4 sm:text-sm rotate-12">
          no cap
        </div>
      </div>
    </div>
  );
}

function RotatingWord() {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % words.length);
        setIsAnimating(false);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <span
      className={`inline-block text-primary font-bold transition-all duration-300 drop-shadow-sm ${
        isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      {words[index]}
    </span>
  );
}

function MonoFunLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground">
      {/* Enhanced Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/3 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-40 left-20 w-80 h-80 bg-muted/40 rounded-full blur-3xl" />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/2 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-1/4 right-1/4 w-32 h-32 bg-primary/5 rounded-full blur-2xl animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "3s" }}
        />
      </div>

      {/* HERO */}
      <section className="relative flex-1 flex items-center justify-center px-4 py-24 min-h-screen">
        <div className="max-w-6xl mx-auto text-center z-10">
          <div className="mb-10 animate-fade-in">
            <div className="inline-flex items-center gap-3 bg-card/90 backdrop-blur-md border border-border/50 rounded-full px-8 py-4 text-sm font-medium text-muted-foreground shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              Learn Modern Slang
              <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
            </div>
          </div>

          <AlphaLingoWordmark />

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black mb-8 leading-tight tracking-tight animate-fade-in-up">
            What does <RotatingWord /> even mean?
          </h1>

          <p
            className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-4xl mx-auto leading-relaxed animate-fade-in-up"
            style={{ animationDelay: "0.2s" }}
          >
            If you've ever heard someone use a word and had no idea what it meant — you're not
            alone.
            <span className="block mt-4 font-semibold text-foreground text-xl">
              Join people staying current with modern language.
            </span>
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in-up"
            style={{ animationDelay: "0.4s" }}
          >
            <Button
              asChild
              size="lg"
              className="px-10 py-6 text-lg font-bold shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
            >
              <Link to="/login" hash="signup" className="flex items-center gap-3">
                Start Learning Now
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="px-10 py-6 text-lg font-semibold border-2 border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 backdrop-blur-sm"
            >
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>

          <div
            className="mb-16 flex flex-wrap items-center justify-center gap-3 animate-fade-in-up"
            style={{ animationDelay: "0.5s" }}
          >
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="rounded-full px-6 py-5 shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              <Link to="/dictionary" className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Browse Dictionary
              </Link>
            </Button>
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="rounded-full px-6 py-5 shadow-lg transition-all duration-300 hover:-translate-y-0.5"
            >
              <Link to="/forum" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Visit Forum
              </Link>
            </Button>
          </div>

          {/* Enhanced product preview */}
          <div
            className="bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl p-8 max-w-lg mx-auto mb-12 hover:shadow-3xl transition-all duration-500 hover:scale-105 hover:-translate-y-2 animate-fade-in-up"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                  Example lesson
                </p>
                <p className="font-bold text-foreground text-2xl">rizz</p>
              </div>
              <div className="h-12 w-12" aria-hidden="true" />
            </div>
            <p className="text-card-foreground mb-4 font-medium text-lg">Charm or charisma.</p>
            <div className="bg-gradient-to-r from-muted/60 to-muted/30 rounded-xl p-4 border-l-4 border-primary shadow-inner">
              <p className="text-muted-foreground italic text-base font-medium">
                "He's got mad rizz."
              </p>
            </div>
          </div>

          <div
            className="flex items-center justify-center gap-3 text-muted-foreground animate-fade-in-up"
            style={{ animationDelay: "0.8s" }}
          >
            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent to-border rounded"></div>
            <p className="text-base font-medium">Scroll to learn more</p>
            <div className="w-12 h-0.5 bg-gradient-to-l from-transparent to-border rounded"></div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="px-4 py-32 bg-gradient-to-b from-background to-muted/10 relative overflow-hidden">
        {/* Section background decoration */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-muted/20 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-foreground leading-tight">
              Keep up without feeling lost
            </h2>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Quick lessons, real examples, and slang you'll actually remember — all in a clean,
              easy-to-read interface designed for modern learners.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-10 mb-24">
            <div className="group p-8 rounded-3xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-2xl transition-all duration-700 hover:-translate-y-4 hover:border-primary/30 hover:bg-card/90">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-3 text-foreground">Lessons</h3>
              <p className="text-muted-foreground leading-relaxed text-base">
                Master modern slang through bite-sized lessons, real examples, and quick review
                drills.
              </p>
            </div>

            <div className="group p-8 rounded-3xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-2xl transition-all duration-700 hover:-translate-y-4 hover:border-primary/30 hover:bg-card/90">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Search className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-3 text-foreground">Dictionary</h3>
              <p className="text-muted-foreground leading-relaxed text-base">
                Look up approved slang terms, definitions, and examples in a searchable reference
                library.
              </p>
              <Button
                asChild
                variant="ghost"
                className="mt-5 px-0 text-primary hover:bg-transparent"
              >
                <Link to="/dictionary" className="inline-flex items-center gap-2">
                  Open dictionary
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="group p-8 rounded-3xl bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg hover:shadow-2xl transition-all duration-700 hover:-translate-y-4 hover:border-primary/30 hover:bg-card/90">
              <div className="w-16 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-bold text-xl mb-3 text-foreground">Forum</h3>
              <p className="text-muted-foreground leading-relaxed text-base">
                Ask questions, share examples, and see how the community uses slang in everyday
                conversation.
              </p>
              <Button
                asChild
                variant="ghost"
                className="mt-5 px-0 text-primary hover:bg-transparent"
              >
                <Link to="/forum" className="inline-flex items-center gap-2">
                  Open forum
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="text-center">
            <Button
              asChild
              size="lg"
              className="px-12 py-6 text-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
            >
              <Link to="/login" hash="signup" className="flex items-center gap-3">
                Get started for free
                <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="px-4 py-32 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
          <div
            className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-border/50 rounded-full px-6 py-3 text-sm font-medium text-muted-foreground shadow-lg">
              <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
              Ready to level up your language game?
            </div>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 text-foreground leading-tight">
            Ready to speak the language?
          </h2>
          <p className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Join people who are already staying current with modern slang. Start your journey today
            and never feel lost in conversation again.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="px-12 py-6 text-xl font-bold shadow-2xl hover:shadow-3xl transition-all duration-500 hover:scale-105 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-primary-foreground border-0"
            >
              <Link to="/login" hash="signup" className="flex items-center gap-3">
                Start Learning Now
                <ArrowRight className="h-6 w-6 group-hover:transl ate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
