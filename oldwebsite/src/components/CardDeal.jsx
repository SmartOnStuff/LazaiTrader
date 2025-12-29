import React from 'react'
import { card } from '../assets'
import styles, { layout } from '../style'
import Button from './Button'

const CardDeal = () => {
  return (
    <section className={layout.section}>
      <div className={layout.sectionInfo}>
        <h2 className={styles.heading2}>Unlock the Power of gMetis on Hercules DEX</h2>
        <p className={`${styles.paragraph} max-w-[470px] mt-5`}>
          Join the revolution with gMetis, now whitelisted on the leading DEX on Metis: Hercules DEX. Secure your gMetis tokens effortlessly and become a part of a thriving community. Holding gMetis not only boosts your rewards but also positions you at the forefront of innovation. Don't miss out on this opportunity to maximize your earnings and influence within the gMetis ecosystem.
        </p>
        <Button 
          styles="mt-10" 
          text="Buy on Hercules DEX" 
          link="https://app.hercules.exchange/?outputCurrency=0xFbe0F778e3c1168bc63d7b6F880Ec0d5F9E524E6" 
        />
      </div>
      <div className={layout.sectionImg}>
        <img
          src={card}
          alt='card'
          className='w-[100%] h-[100%]'
        />
      </div>
    </section>
  )
}

export default CardDeal
