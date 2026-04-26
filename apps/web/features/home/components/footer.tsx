import { Button } from '@workspace/ui/components/button'
import { Separator } from '@workspace/ui/components/separator'
import { FaXTwitter, FaDiscord  } from "react-icons/fa6";

import Image from 'next/image'
import Link from 'next/link'

export const Footer = () => {
  return (
    <footer className='mt-12'>
      <div className='container flex flex-col max-w-7xl justify-between gap-3 px-4 py-4 max-md:flex-col sm:px-6 sm:py-6 md:gap-6 md:py-8'>
        <Link href="/">
          <div className='flex items-center gap-3'>
            <Image src="/logo.svg" alt="Logo" height="25" width="25" className='gap-3' />
            <span className='text-md'>Orbit</span>
          </div>
        </Link>
        <div className="flex items-center justify-between">

        <div className='flex items-center gap-1 whitespace-nowrap text-sm text-muted-foreground'>
          <Link href="/#">
            <Button variant="ghost" size="sm">
                Home
            </Button>
          </Link>
          <Link href="/#">
            <Button variant="ghost" size="sm">
                About
            </Button>
          </Link>
          <Link href="/#">
            <Button variant="ghost" size="sm">
                Contact
            </Button>
          </Link>
        </div>

        <div className='flex items-center gap-1'>
          <Link href="#">
            <Button variant="ghost" className='text-muted-foreground hover:text-foreground'>
              <FaXTwitter/>
            </Button>
          </Link>
          <Link href="#">
            <Button variant="ghost" className='text-muted-foreground hover:text-foreground'>
              <FaDiscord/>
            </Button>
          </Link>
        </div>
        </div>
      </div>

      <Separator />

      <div className='container flex px-4 py-8 sm:px-6'>
        <p className='text-sm text-muted-foreground'>
          {`©${new Date().getFullYear()}`}{' '}
          ADE. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
