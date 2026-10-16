type ProjectPreviewProps = { project: 'detailing' | 'personal'; mobile?: boolean; eager?: boolean };

export default function ProjectPreview({ project, mobile = false, eager = false }: ProjectPreviewProps) {
  const detailing = project === 'detailing';
  return <div className={`design-excerpt ${detailing ? 'excerpt-detailing' : 'excerpt-personal'} ${mobile ? 'excerpt-mobile' : ''}`}>
    <div className="excerpt-browser"><span aria-hidden="true">● ● ●</span><span>{detailing ? 'shipleysdetailing.com' : 'jadenshipley.com'}</span></div>
    <div className="excerpt-page">
      <div className="excerpt-nav"><b>{detailing ? 'SHIPLEY’S DETAILING' : 'JADEN SHIPLEY'}</b><span>About &nbsp; {detailing ? 'Services' : 'My story'} &nbsp; Contact</span></div>
      <img src={detailing ? '/projects/detailing-hero.webp' : '/projects/jaden-portrait.webp'} alt={detailing ? 'Original Tesla photograph used on the Shipley’s Detailing website' : 'Portrait used on Jaden Shipley’s personal website'} width={detailing ? 960 : 600} height={detailing ? 1280 : 901} loading={eager ? 'eager' : 'lazy'} />
      <div className="excerpt-content"><span>{detailing ? 'EXCEPTIONAL CAR CARE.' : 'AN INTRODUCTION'}</span><strong>{detailing ? <>Your car.<br/>Only <em>better.</em></> : <>Jaden<br/><em>Shipley.</em></>}</strong><p>{detailing ? 'That first-drive feeling, all over again.' : 'I’m building my future one experience at a time.'}</p><span className="excerpt-button" aria-hidden="true">{detailing ? 'Explore services' : 'Read my story'} ↗</span></div>
      <div className="excerpt-bottom">{detailing ? 'Protect. Enhance. Preserve.' : 'My story. My work. What’s next.'}</div>
    </div>
  </div>;
}
