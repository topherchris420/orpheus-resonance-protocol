import { Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const plate = '/art/resonance-plate.webp';
const description = 'A brass resonance plate covered in a flower-like pattern of fine golden sand.';

export const ResonancePlate = () => (
  <figure className="plate-figure">
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="plate-view" aria-label="Inspect cymatic plate">
          <img
            src={plate}
            srcSet={`/art/resonance-plate-small.webp 600w, ${plate} 1200w`}
            sizes="(max-width: 640px) 94vw, (max-width: 1500px) 54vw, 780px"
            width={1200}
            height={800}
            alt={description}
            fetchPriority="high"
          />
          <span className="plate-expand"><Maximize2 aria-hidden="true" size={16} /></span>
        </button>
      </DialogTrigger>
      <DialogContent className="plate-dialog">
        <DialogTitle>Cymatic plate</DialogTitle>
        <img src={plate} width={1200} height={800} alt={description} />
        <DialogDescription>Concept illustration of a Chladni plate. Sand traces the still regions of a vibrating surface.</DialogDescription>
      </DialogContent>
    </Dialog>
    <figcaption><span className="plate-rule" aria-hidden="true" />Cymatic plate <span aria-hidden="true">/</span> Standing-wave illustration</figcaption>
  </figure>
);
