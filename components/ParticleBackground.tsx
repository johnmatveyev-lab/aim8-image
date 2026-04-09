
import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSize: number; // Remember original size
  size: number;     // Current size (animated)
  color: string;
}

export const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let mouse = { x: -1000, y: -1000 };

    // Configuration
    const PARTICLE_COUNT = 80; // Increased density
    const CONNECTION_DISTANCE = 150;
    const MOUSE_DISTANCE = 200;
    const PURPLE = '139, 92, 246'; // aim-purple
    const CYAN = '0, 216, 255';    // aim-accent

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const size = Math.random() * 2 + 0.5;
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.5, 
          vy: (Math.random() - 0.5) * 0.5,
          baseSize: size,
          size: size,
          color: `rgba(${PURPLE}, 0.4)`
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Create an explosion effect on click
      const clickX = e.clientX;
      const clickY = e.clientY;
      const blastRadius = 300;

      particles.forEach(p => {
        const dx = p.x - clickX;
        const dy = p.y - clickY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < blastRadius) {
          const force = (blastRadius - distance) / blastRadius;
          const angle = Math.atan2(dy, dx);
          const blastStrength = 15; // Power of the click

          p.vx += Math.cos(angle) * force * blastStrength;
          p.vy += Math.sin(angle) * force * blastStrength;
        }
      });
    };

    const draw = () => {
      // Fade effect for trails (optional, currently using clearRect for performance)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach((p, i) => {
        // Movement
        p.x += p.vx;
        p.y += p.vy;

        // Bounce off edges with damping
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Mouse interaction
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Default State
        let targetSize = p.baseSize;
        let targetAlpha = 0.4;
        let targetColor = PURPLE;

        if (distance < MOUSE_DISTANCE) {
          // Interactive State
          const force = (MOUSE_DISTANCE - distance) / MOUSE_DISTANCE;
          
          // 1. Repulsion (gentle)
          const repulsionStrength = 0.05; 
          p.vx -= (dx / distance) * force * repulsionStrength;
          p.vy -= (dy / distance) * force * repulsionStrength;

          // 2. "Charging" effect - Grow and brighten
          targetSize = p.baseSize * (1 + force * 1.5); // Grow up to 2.5x
          targetAlpha = 0.4 + (force * 0.6); // Becomes opaque
          targetColor = CYAN; // Shift to accent color

          // Draw connection to mouse
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${CYAN}, ${0.2 * force})`;
          ctx.lineWidth = 1 * force;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }

        // Smoothly interpolate size
        p.size += (targetSize - p.size) * 0.1;

        // Friction (Slow down eventually)
        p.vx *= 0.96;
        p.vy *= 0.96;
        
        // Maintain minimum ambient movement
        const minSpeed = 0.1;
        if (Math.abs(p.vx) < minSpeed && Math.abs(p.vy) < minSpeed) {
           // Add tiny random impulse if stopped
           p.vx += (Math.random() - 0.5) * 0.05;
           p.vy += (Math.random() - 0.5) * 0.05;
        }

        // Draw Particle
        ctx.beginPath();
        ctx.fillStyle = `rgba(${distance < MOUSE_DISTANCE ? targetColor : PURPLE}, ${targetAlpha})`;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        // Connect to nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < CONNECTION_DISTANCE) {
            // Opacity based on distance between particles AND distance to mouse (brighter near mouse)
            const mouseInfluence = Math.max(0, 1 - distance / MOUSE_DISTANCE); // 0 to 1
            const baseOpacity = 0.1 * (1 - dist2 / CONNECTION_DISTANCE);
            const boostedOpacity = baseOpacity + (mouseInfluence * 0.15); // Boost brightness near mouse

            ctx.beginPath();
            ctx.strokeStyle = `rgba(${mouseInfluence > 0.2 ? CYAN : PURPLE}, ${boostedOpacity})`;
            ctx.lineWidth = 0.5 + (mouseInfluence * 0.5);
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    
    resize();
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: 'transparent' }} 
    />
  );
};
