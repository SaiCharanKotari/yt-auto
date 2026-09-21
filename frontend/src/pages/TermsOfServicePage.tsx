import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

type PolicyTab = 'terms' | 'privacy' | 'api';

interface Section {
  id: string;
  num: string;
  title: string;
  content: React.ReactNode;
}

export default function TermsOfServicePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as PolicyTab) || 'terms';
  const [activeTab, setActiveTab] = useState<PolicyTab>(initialTab);
  const [activeSection, setActiveSection] = useState('sec-1');

  useEffect(() => {
    const tab = searchParams.get('tab') as PolicyTab;
    if (tab && (tab === 'terms' || tab === 'privacy' || tab === 'api')) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: PolicyTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Terms of Service Sections (Directly Sourced & Customized from .terms for cliy) ──
  const termsSections: Section[] = useMemo(() => [
    {
      id: 'sec-1',
      num: '1',
      title: 'Acceptance of Terms of Service',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>1.1</strong> Please read these Terms of Service carefully. These Terms of Service ("Agreement" or "Terms of Service") are a legally binding agreement between you (either an individual or an entity) ("you" or "User") and <strong>cliy</strong> ("we", "our" or "us") regarding the use of cliy, ClipFlow, and other related websites owned and/or operated by cliy (collectively, the "Website"), products and services.
          </p>
          <p>
            <strong>1.2</strong> You may use the services provided through this website only if you accept all the terms and conditions contained in these Terms of Service. By accessing, visiting, using, downloading, copying and/or joining (collectively, "using") the Service, you understand and accept these Terms, including the most recent version. If you do not agree to be bound by these Terms, please stop using the Service and delete any copies of the Service you may have.
          </p>
          <p>
            <strong>1.3</strong> We may modify these Terms of Service at any time without notice. Please review these Terms of Service periodically to ensure that you understand all terms governing your use of the Site and Services.
          </p>
          <p>
            <strong>1.4</strong> No one under 18 is allowed to use the Services. You hereby warrant that you are at least 18 years old. In the event that the information you provide in this regard is not truthful, cliy shall not be liable as it cannot verify the age of its users. If you are under the age of 18, you may use the Service only with the approval of your parent or guardian. In addition, you should review these terms with your parent or guardian to make sure that you and your parent or guardian understand and agree with these terms.
          </p>
          <p>
            <strong>1.5</strong> If you use the Services on behalf of a company or other entity then "you" includes you and that entity, and you represent and warrant that (a) you are an authorized representative of the entity with the authority to bind the entity to these Terms, and (b) you agree to these Terms on the entity’s behalf.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-2',
      num: '2',
      title: 'Grant of Use',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>2.1</strong> We grant you a non-exclusive, non-transferable, and limited right to access, non-publicly display, and use the Service, including all content available therein (the "Content") on your computer or mobile device consistent with these Terms and subject to the restrictions (technical and otherwise) of the Service. You may only access and use the Service for your personal and noncommercial use.
          </p>
          <p>
            <strong>2.2</strong> This grant is terminable by us at will for any reason and at our sole discretion, with or without prior notice. You agree not to use or attempt to use the Service after said termination. Upon termination, the grant of your right to use the Service shall terminate, but all other portions of these Terms shall survive. You acknowledge that we are not responsible to you or any third party for the termination of your grant of use.
          </p>
          <p>
            <strong>2.3</strong> In addition to the terms set forth herein, your use of the Service shall be limited by the rules, features and technical restrictions of the Service, which may change from time to time in our sole discretion. You shall not attempt to use the Service in any manner in which the Service is not intended or permitted to be used.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-3',
      num: '3',
      title: 'Our Rights and Responsibilities',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>3.1</strong> The information provided via cliy and the service website is offered on an "as is" and "as available" basis without any express or implied warranties or conditions (whether statutory or under common law), including, without limitation, any warranties regarding accuracy, fitness for a particular purpose, non-infringement, uninterrupted service, reliability, security, timeliness, or protection against computer viruses. We assume no liability for any errors, omissions, misrepresentations, or inaccuracies in the information.
          </p>
          <p>
            <strong>3.2</strong> We may provide updates or upgrades to the website that may for example include bug fixes, new features, or other enhancements (collectively: "Updates"). However, you acknowledge and agree that we have no obligation to provide any Updates, and that we may modify, suspend, or discontinue any aspect of the website at any time, without notice or liability to you.
          </p>
          <p>
            <strong>3.3</strong> Restrict or suspend your access to the cliy Services if, in our judgment, you have violated any provision of these Terms of Service, without prior notice.
          </p>
          <p>
            <strong>3.4</strong> We shall not be liable for any loss, damage, or other harm resulting from your use, misuse, inability to use, or reliance on the cliy Services or any content, including third-party materials, or external website content, regardless of whether such losses are based on warranty, contract, tort (including negligence), misrepresentation, or any other legal theory, even if we have been advised of the possibility of such damages.
          </p>
          <p>
            <strong>3.5</strong> When accessing web pages or websites linked from the cliy Services, you may be subject to additional or different terms and conditions. In such cases, these Terms of Service, together with the additional terms, will apply concurrently. In the event of any conflict, the additional terms shall prevail.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-4',
      num: '4',
      title: 'Your Responsibilities',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>4.1</strong> You acknowledge that cliy is a general-purpose tool. Specifically, but without limitation, cliy allows you to access media on multiple other platforms and to, among other things, download and/or convert that media. cliy may only be used in accordance with law. We do not encourage, condone, induce, or allow any use of cliy that may be in violation of any law. We explicitly prohibit the use of cliy to download any content in violation of copyright laws.
          </p>
          <p>
            <strong>4.2</strong> You may only use cliy consistent with these Terms and any and all agreements under which cliy is provided to you. You agree to abide by all applicable local, state, national and international laws and regulations. You agree that you are solely responsible for all acts and omissions that occur as a result of your use of cliy.
          </p>
          <p>
            <strong>4.3</strong> You agree not to use cliy for any unlawful purpose or in any way that is prohibited by these Terms. You agree not to engage in any of the following prohibited activities:
          </p>
          <ul className="list-none space-y-1.5 pl-4 text-zinc-300">
            <li><strong>a)</strong> copying, distributing, or disclosing any part of cliy, including without limitation by any automated or non-automated "scraping";</li>
            <li><strong>b)</strong> using any automated system, including without limitation "robots," "spiders," "offline readers," etc., to access cliy;</li>
            <li><strong>c)</strong> transmitting spam, chain letters, or other unsolicited email;</li>
            <li><strong>d)</strong> attempting to interfere with, compromise the system integrity or security or decipher any transmissions to or from the servers running cliy;</li>
            <li><strong>e)</strong> taking any action that imposes, or may impose at our sole discretion an unreasonable or disproportionately large load on our infrastructure;</li>
            <li><strong>f)</strong> uploading invalid data, viruses, worms, or other software agents through cliy;</li>
            <li><strong>g)</strong> using cliy for any commercial solicitation purposes;</li>
            <li><strong>h)</strong> interfering with the proper working of cliy;</li>
            <li><strong>i)</strong> accessing any content through any technology or means other than those provided or authorized by cliy;</li>
            <li><strong>j)</strong> bypassing the measures we may use to prevent or restrict access to cliy;</li>
            <li><strong>k)</strong> copying, imitating or using, in whole or in part of cliy without the prior written consent of cliy;</li>
            <li><strong>l)</strong> framing or hotlinking to cliy or any content other than your own without the prior written consent of cliy.</li>
          </ul>
          <p className="pt-2">
            <strong>4.4</strong> You agree that while using our Service you shall not download or otherwise make available materials that:
          </p>
          <ul className="list-none space-y-1.5 pl-4 text-zinc-300">
            <li><strong>a)</strong> are copyrighted, protected by trade secret or trademark laws, or otherwise subject to third party proprietary rights, including privacy and publicity rights, unless you are the owner of such rights, have explicit permission from the rightful owner to submit the material and to grant us all of the license rights granted herein, or have other legal and effective basis to the material and to grant us all of the license rights granted herein;</li>
            <li><strong>b)</strong> are obscene, vulgar, illegal, unlawful, defamatory, fraudulent, libelous, harmful, harassing, abusive, threatening, invasive of privacy or publicity rights, hateful, racially or ethnically offensive, inflammatory, or otherwise inappropriate as decided by us in our sole discretion;</li>
            <li><strong>c)</strong> depict illegal activities, promotes or depicts physical harm or injury against any group or individual, or promotes or depicts any act of cruelty to animals;</li>
            <li><strong>d)</strong> impersonate any person or entity or otherwise misrepresents you in any way, including creating a false identity;</li>
            <li><strong>e)</strong> would constitute, encourage or provide instructions for a criminal offense, a violation of the rights of any party, or that would otherwise create liability or violate any local, state, national or international law; or</li>
            <li><strong>f)</strong> are unsolicited or unauthorized advertising, promotion, "spam" or any other form of solicitation.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'sec-5',
      num: '5',
      title: 'Intellectual Property',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>5.1</strong> Copyright, trademark and all other proprietary rights in the Website, cliy, ClipFlow, Services, and Content (including but not limited to services, audio, video, text and photographs, but excluding User Content) rest with cliy and/or its licensors. Unless otherwise specifically provided herein or authorized by cliy in writing, all rights in the Website, Services, and Content not expressly granted herein are reserved. You agree not to copy, republish, frame, make available for download, transmit, modify, rent, lease, loan, sell, assign, distribute, license, sublicense, reverse engineer, or create derivative works based on the Content, Website, cliy, or Services, other than in conjunction with the Services offered by cliy through the Websites.
          </p>
          <p>
            <strong>5.2</strong> cliy hereby disclaims any rights to trademarks, service marks, trade names, logos, copyright, patents, domain names or other intellectual property interests of third parties. All intellectual property interests of third parties referenced herein, including without limitation Third Party Material or otherwise provided on this Website are the properties of their respective owners. cliy disclaims any proprietary interests in the intellectual property rights other than their own.
          </p>
          <p>
            <strong>5.3</strong> You acknowledge and agree that we may use any feedback, suggestions, or ideas that you provide in connection with the Service, without any obligation to compensate you or acknowledge your contribution.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-6',
      num: '6',
      title: 'Copyright Claims (DMCA)',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            It is our policy to respond to notices of alleged copyright infringement that comply with applicable international intellectual property law, including the Digital Millennium Copyright Act ("DMCA"). If you believe that any of your copyrighted material is being infringed, please let us know by submitting your claim to: <a href="mailto:clipflovv@gmail.com" className="text-white underline hover:text-zinc-300">clipflovv@gmail.com</a>.
          </p>
          <p className="font-semibold text-white">To submit your claim successfully, you must provide us with the following information:</p>
          <ul className="list-none space-y-1.5 pl-4 text-zinc-300">
            <li><strong>a)</strong> Identification of the copyrighted work that is believed to be infringed. Please describe the work and, where possible, include a copy or the location (e.g., a URL) of an authorized version of the work;</li>
            <li><strong>b)</strong> Identification of the material that is believed to be infringing and its location or, for search results, identification of the reference or link to material or activity claimed to be infringing. Please describe the material and provide a URL or any other pertinent information that will allow us to locate the material on the Service or on the Internet;</li>
            <li><strong>c)</strong> Information that will allow us to contact you, including your address, telephone number and, if available, your e-mail address;</li>
            <li><strong>d)</strong> A statement that you have a good faith belief that the use of the material complained of is not authorized by you, your agent or the law;</li>
            <li><strong>e)</strong> A statement that the information in the notification is accurate and that under penalty of perjury that you are the owner or are authorized to act on behalf of the owner of the work that is allegedly infringed; and</li>
            <li><strong>f)</strong> A physical or electronic signature from the copyright holder or an authorized representative.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'sec-7',
      num: '7',
      title: 'Personal Information & Privacy',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            We retain a separate Privacy Policy and your assent to these Terms also signifies that you have read and understand the Privacy Policy. We reserve the right to amend the Privacy Policy at any time by posting such amendments to the Service or our website. No other notification may be made to you about any amendments. Your continued use of the App following such amendments will be deemed your acknowledgement of the Privacy Policy and that you have read and understand it.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-8',
      num: '8',
      title: 'Third Party Links',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>8.1</strong> The Service may contain links to third party websites, advertisers, services, special offers or other activities that are not owned or controlled by us. We don’t endorse or assume any responsibility for any such third party sites, information, materials, products, or services. If you access any third party website, service, or content from the Service, you do so at your own risk and you agree that we have no liability arising from your use of or access to any third party website, service, or content.
          </p>
          <p>
            <strong>8.2</strong> You understand and acknowledge that using our Service you may be exposed to content that is inaccurate, offensive, indecent or otherwise objectionable or may cause harm to your computer systems and, without limiting the other limitation of liability provisions herein, you agree to waive, and hereby do waive, any legal or equitable rights or remedies you may have against us with respect thereto. You understand and acknowledge that we may at our sole discretion refuse to publish, remove, or block access to any content for any reason, or for no reason at all, with or without notice.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-9',
      num: '9',
      title: 'Warranties and Disclaimers',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>9.1</strong> All content and/or services are provided "as is" and "as available". cliy hereby expressly disclaims any representations or warranties of any kind, express or implied, including without limitation warranties of merchantability, fitness for any particular purpose, non-infringement, or as to the operation of this website, services or the content. cliy does not warrant or make any representations as to the security of the cliy website, services, or content. You acknowledge that any information sent may be intercepted in transmission or otherwise. cliy does not warrant that the website, services, content, or the servers which make this website available or electronic communications sent by cliy are free from viruses or any other harmful elements. Except as agreed by cliy in writing, contractors, agents, dealers or distributors of cliy or any other third party shall not have a right to modify this limited warranty, nor to make any additional warranties.
          </p>
          <p>
            <strong>9.2</strong> The use of the website, or services or the downloading or other use of any products through the website is done at your own discretion and risk and with your agreement that you will be solely responsible for any damage to your computer system, loss of data, or other harm that results from such activities. cliy assumes no liability for any computer virus or other similar software code that is downloaded to your computer from the website or in connection with any services or products offered through the website. No advice or information whether oral or written, obtained by you from cliy or from the website shall create any warranty not expressly stated in the terms of service.
          </p>
          <p>
            <strong>9.3</strong> The website and services may contain references to specific cliy products and services that may not be available in a particular country. Any such reference does not imply or warrant that any such products or services shall be available at any time in any particular country.
          </p>
          <p>
            <strong>9.4</strong> You understand and agree that by using the website and services, you may be exposed to content that you may find offensive, indecent or objectionable and that, in this respect, you use the website and services at your own risk.
          </p>
          <p>
            <strong>9.5</strong> In no event shall cliy or any of its affiliates be liable for any direct, indirect, consequential, punitive, special or incidental damages (including, without limitation, damages for loss of business, contract, revenue, data, information or business interruption), under any theory of liability, resulting from, arising out of or in connection with the use of, or inability to use the website, or services or the content, products, services, statements or actions of any third party on or through the website and services, any unauthorized access to or alteration of your transmission or data, any information that is sent or received, or not sent or received, any failure to store data, any loss of data, loss or damage to files, loss or damage to the content, any services available through the website.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-10',
      num: '10',
      title: 'Indemnification',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            You agree to defend, indemnify and hold harmless the Service and its subsidiaries, agents, licensors, managers, and other affiliated companies, and their employees, contractors, agents, officers and directors, from and against any and all claims, damages, obligations, losses, liabilities, costs or debt, and expenses arising from: (a) your use of and access to the Service, including any data or content transmitted or received by you; (b) your violation of any part of this Terms, including without limitation your breach of any of the representations and warranties above; (c) your violation of any third-party right, applicable law, rule, or regulation. We will not bear responsibility for any damages, claims, liabilities, losses and other expenses, whether or not a lawsuit or other proceeding is filed, that arise out of the User's breach of these Terms. To the maximum extent permitted by the applicable law, you and we agree not under any circumstances to bring or participate in a class or representative action, private attorney general action or collective arbitration.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-11',
      num: '11',
      title: 'Termination of Services',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>11.1</strong> The term of this Agreement shall be effective upon your commencement of use of the Site or Services and shall continue in perpetuity unless terminated by cliy or you in writing. cliy reserves the right to change, suspend or discontinue the Services or any part thereof at any time. Without prejudice to any other rights, these Terms of Service shall terminate automatically if you fail to comply with any restrictions or other requirements set forth herein. Upon termination or expiration of these Terms of Service, you must immediately cease any use of the Site and Services, including, without limitation, any use of cliy trademarks, trade names, copyrights and other intellectual property.
          </p>
          <p>
            <strong>11.2</strong> Upon termination of this Agreement, you are no longer authorized to use the Site or Services in any manner.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-12',
      num: '12',
      title: 'Changes to These Terms of Service',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>12.1</strong> We reserve the right to modify these Terms of Service at any time without prior notice, in order to comply with legal requirements, changes in our business relationships, or modifications to the cliy Services provided to you. If you do not agree to the modified terms, please discontinue your use of the cliy Services.
          </p>
          <p>
            <strong>12.2</strong> Any updated version of these Terms of Service shall supersede and replace the previous version, and the previous version shall immediately terminate upon the effective date of the updated terms.
          </p>
        </div>
      ),
    },
    {
      id: 'sec-13',
      num: '13',
      title: 'Contact Information & Governing Law',
      content: (
        <div className="space-y-3 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            These Terms shall be governed by and construed in accordance with the laws applicable to online service providers. For inquiries, legal notices, or DMCA communications, please contact:
          </p>
          <div className="pt-2 font-mono text-xs sm:text-sm text-zinc-300 space-y-1">
            <p><strong>Operator:</strong> cliy</p>
            <p><strong>Website:</strong> <a href="https://clipflow.cliy.me" target="_blank" rel="noopener noreferrer" className="text-white underline hover:text-zinc-300">clipflow.cliy.me</a></p>
            <p><strong>Contact Email:</strong> <a href="mailto:clipflovv@gmail.com" className="text-white underline hover:text-zinc-300">clipflovv@gmail.com</a></p>
          </div>
        </div>
      ),
    },
  ], []);

  // ── Privacy Policy Sections (Directly Sourced & Customized from .privacy for cliy) ──
  const privacySections: Section[] = useMemo(() => [
    {
      id: 'priv-1',
      num: '1',
      title: 'Types of User Data Collected',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>1.1</strong> We may collect information regarding the use of our Website, especially with respect to your browsing (pages visited, links clicked, etc.). Some of this information may be collected using cookies placed in your web browser when you browse our website. The information that we request is and will be retained by us and used as described in this Privacy Policy. We do not request or intend to collect any “special categories of information” such as any information on health, race, religion, political opinions or philosophical beliefs, sexual preferences or orientation.
          </p>
          <p>
            <strong>1.2</strong> When you request a page from our Website, our servers log the information provided in the HTTP request header, JavaScript or similar technical tools, including the IP number, the time of the request, the URL of your request and other information. We collect this information in order to make our Website function correctly and provide you the functionality that you see on the Website, as our servers use this information to deliver to you the pages on this Website. We also use this information to better understand how visitors use our Website and how we can better tune our Website, its contents and functionality to meet your needs. However, this information is not associated with any personally identifiable information of persons browsing the Website.
          </p>
          <p>
            <strong>1.3</strong> When you use the Website, cliy or trusted third parties authorized by cliy may also collect certain technical and routing information about your computer (also known as environmental variables) to facilitate your use of the Website and the Services enabled thereby. When you browse the Internet, your Internet browser automatically transmits some information to cliy every time you access content on one of our internet domains. Examples of such information include the URL of the particular Web page you visited, the IP (Internet Protocol) address of the computer you are using, or the browser version that you are using to access the Website. All of this information may be collected by cliy and used to help improve our offerings to you.
          </p>
          <p>
            <strong>1.4</strong> We use cookies and other similar technologies to help provide our Services, to advertise to you and to analyse how you use our Services and whether advertisements are being viewed. By continuing to use and navigate our sites, services, tools or messaging, you are agreeing to our use of cookies described in this Privacy Policy.
          </p>
          <p>
            <strong>1.5</strong> Our Website also may contain links to other third-party websites. cliy is not responsible for the privacy practices or the content of such websites. We encourage you to carefully read the privacy statement of any website you visit. cliy may make third party applications available to you through the Website or Services. The information collected by cliy when you enable a third party application is processed under this Privacy Policy. Information collected by the third party application provider is governed by the provider's privacy policies.
          </p>
        </div>
      ),
    },
    {
      id: 'priv-2',
      num: '2',
      title: 'Purpose of the Use of Your Personal Information',
      content: (
        <div className="space-y-3 text-sm leading-relaxed text-[#d1d5db]">
          <p>The primary purposes for collecting and using your personal information include:</p>
          <ul className="list-none space-y-1.5 pl-4 text-zinc-300">
            <li><strong>a) Delivering and improving our services:</strong> We use your information for developing, delivering and improving our Service, providing updates, technical troubleshooting, understanding and analyzing trends in connection with usage of the Services;</li>
            <li><strong>b) Displaying advertisements:</strong> We may use your information for displaying third-party advertisements to make our Services available for free;</li>
            <li><strong>c) Cross-promotion:</strong> We may use your information for cross-promoting our Services;</li>
            <li><strong>d) Tracking and fraud prevention for advertising purposes:</strong> Your information is used for tracking how our advertising campaigns perform and for identifying and preventing fraud for our advertising campaigns;</li>
            <li><strong>e) Analytics and research:</strong> We use your information for understanding about the usage of the Services. We may also create reports and analysis for the purposes of research, for example to track potential problems or to test our new features connected with our Services;</li>
            <li><strong>f) Security:</strong> We use your information for enhancing the safety and security of our Services;</li>
            <li><strong>g) Customer Support:</strong> We use your information for providing customer support to you and to respond to your inquiries;</li>
            <li><strong>h) Our legal obligations:</strong> To comply with applicable legal or regulatory obligations, including as part of a judicial proceeding, to respond to a subpoena, warrant, court order, or other legal process, or as part of an investigation or request, whether formal or informal, from law enforcement or a governmental authority;</li>
            <li><strong>i) Consent:</strong> When you have given your consent for the processing of your data and of your browsing data via cookies, etc.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'priv-3',
      num: '3',
      title: 'Use of Cookies',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>3.1</strong> We use cookies and similar technologies like web beacons, pixel tags, or local shared objects (“flash cookies”), to deliver, measure, and improve the Service in various ways. A cookie is a small text file that identifies your computer on our server. Cookies in themselves do not identify the individual user, only the computer being used. Cookies are not used to gather personal information.
          </p>
          <p>
            <strong>3.2</strong> You may, at any time, configure your computer to accept all cookies, to notify you when a cookie is issued, and to reject the reception of any cookies. Settings vary from one type of browser software to another. Details can generally be found in your browser software help menu. We therefore encourage you to look at your settings to find out how you can make choices regarding cookies. You may choose to decline all cookies on your computer, but if you do choose to decline cookies, then you may be limited to certain areas of the Service.
          </p>
          <p>
            <strong>3.3</strong> We also work with a number of analytics partners, who use cookies and similar technologies to help us analyze how users use the Service. By using our Service you agree to our use of cookies. Please note that Third Party Cookies, which include the use of cookies by our partners, affiliates and service providers, are not covered by our privacy statement. We do not have access to or control over these cookies. In addition, cliy does not have access to any cookie-specific information collected directly by Third Party Cookies. To obtain access to or review your cookie-specific information, you will need to contact the third party as they control the cookie(s). These cookies are not essential to browsing on our website.
          </p>
        </div>
      ),
    },
    {
      id: 'priv-4',
      num: '4',
      title: 'Use and Sharing of User Data',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            By using our services, you consent to our collection and storage of the aforementioned personal information. We will manage and protect your data according to strict security and confidentiality standards. Your data will not be disclosed to any third party except under the following persons or circumstances:
          </p>
          <ul className="list-none space-y-1.5 pl-4 text-zinc-300">
            <li><strong>a)</strong> We may share your personal data with our affiliates which may access your personal data to help us develop, maintain and provide our Service and help manage our customer relationships and service providers provide us support for the Service.</li>
            <li><strong>b)</strong> We may share certain information such as your location, browser and cookie data and other data relating to your use of the Service with our business partners to deliver personalized advertisements that may be of interest to you.</li>
            <li><strong>c)</strong> We may also share non-personal data with interested third parties to help them understand the usage patterns for certain services or conduct independent research based on such anonymous usage data. Within our Service, there may be links to third-party websites or applications. We are not responsible for the content or privacy compliance of third party websites or applications. You should check those websites or applications for their privacy statements and applicable terms.</li>
            <li><strong>d) For Legal and Other Purposes:</strong> We may access, preserve and disclose information to investigate, prevent, or take action in connection with legal process and legal requests, requests for customer service, technical issues or as otherwise required by law.</li>
            <li><strong>e) New Ownership:</strong> If the ownership or control of all or part of cliy or a specific Service changes as a result of a merger, acquisition or sale of assets, we may transfer your information to the new owner.</li>
            <li><strong>f) Data Processing and Transfers:</strong> cliy operates secure data networks protected by industry standard firewall and password protection systems. Our security and privacy policies are periodically reviewed and enhanced as necessary, and only authorized individuals have access to the information provided by our users. cliy takes steps to ensure that your information is treated securely and in accordance with this Privacy Policy. Because laws applicable to personal information vary by country, our offices or other business operations may put in place additional measures that vary depending on the applicable legal requirements. Your information is only accessible to those cliy employees who need it in order to perform their jobs. Legal periods of retention of your personal information is defined by cliy to comply with the legal obligations covering cliy.</li>
            <li><strong>g) Cross-Border Transfers:</strong> When you submit personal information to cliy through the Website, you understand and agree that this information may be transferred across national boundaries. In addition, you authorize cliy to transfer, process, store and use your information in countries other than your own in accordance with this Privacy Policy and to provide you with Services. All data transfers are subject to appropriate guarantees, especially contractual, technical and organizational guarantees, that comply with applicable regulations relating to the protection of personal data.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'priv-5',
      num: '5',
      title: 'Advertising',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            Ads appearing on our site may be delivered to Users by advertising partners, who may set cookies. These cookies allow the ad server to recognize your computer each time they send you an online advertisement to compile non personal identification information about you or others who use your computer. This information allows ad networks to, among other things, deliver targeted advertisements that they believe will be of most interest to you. This privacy policy does not cover the use of cookies by any advertisers.
          </p>
        </div>
      ),
    },
    {
      id: 'priv-6',
      num: '6',
      title: 'Security',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            At cliy, the security of your information is our top priority. We have implemented numerous stringent measures to protect our data against unauthorized access, disclosure, or destruction. Your data is stored only in facilities that meet the highest standards of security. Professional security personnel strictly monitor physical access to our facilities using video surveillance and other electronic measures.
          </p>
        </div>
      ),
    },
    {
      id: 'priv-7',
      num: '7',
      title: "Children's Protection",
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            cliy Website and any Services available on that site are not directed at children under 18 years or other permitted by the applicable law age. However, we recognize that children under the permitted age may access this Website and subscribe to the newsletter, purchase Software and Services, or download software programs. The collection of information is covered above. Parents and Legal Guardians may request from us to review, delete or stop the collection of the personally identifiable information of their child. You may do so by contacting us by letter or email to: <a href="mailto:clipflovv@gmail.com" className="text-white underline hover:text-zinc-300">clipflovv@gmail.com</a>.
          </p>
        </div>
      ),
    },
    {
      id: 'priv-8',
      num: '8',
      title: 'Retention of User Data',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>8.1</strong> We will retain your information for as long as necessary to provide our services to you, in accordance with applicable law, in order to fulfill our contractual obligations and protect our rights. Once your information is no longer needed for service provision, we will retain it only for legitimate business purposes. In certain circumstances, however, we may be required to retain your data for a longer period to comply with legal obligations or for the establishment, exercise, or defense of legal claims.
          </p>
          <p>
            <strong>8.2</strong> In cases where we need to retain your personal data after you terminate our services, such information will be stored in an aggregated and anonymized format.
          </p>
          <p>
            <strong>8.3</strong> This Privacy Policy is intended to help you understand our general practices, and we may not be able to list every possible disclosure. Apart from the situations described above, we do not guarantee that your information will never be disclosed. For example, third parties might unlawfully intercept or access data transmitted to or contained on our website; technical failures might occur; or unauthorized access, misuse, or abuse of data may happen.
          </p>
          <p>
            <strong>8.4</strong> While we use commercially reasonable methods to protect your privacy, we cannot guarantee that your information or communications will always remain confidential or secure.
          </p>
        </div>
      ),
    },
    {
      id: 'priv-9',
      num: '9',
      title: 'Your Rights',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>9.1</strong> According to data protection and privacy laws, you may be granted certain rights with regards to your Personal Data, all according to your jurisdiction. The rights may include one or all of the following:
          </p>
          <ul className="list-none space-y-1.5 pl-4 text-zinc-300">
            <li><strong>a) Access:</strong> You have the right to access the personal information we hold about you.</li>
            <li><strong>b) Correction:</strong> You have the right to request updates or corrections to any inaccurate personal information.</li>
            <li><strong>c) Consent:</strong> You have the right to modify the scope of your consent.</li>
            <li><strong>d) Deletion:</strong> You have the right to request that we delete your personal information.</li>
          </ul>
          <p className="pt-2">
            <strong>9.2</strong> You may contact us by emailing: <a href="mailto:clipflovv@gmail.com" className="text-white underline hover:text-zinc-300">clipflovv@gmail.com</a>. We will respond to your request as soon as possible. To protect your privacy, you will be required to complete an application form and provide proof of identity. If you fail to provide, or if the information provided is false, such that we cannot verify your identity, we will be unable to process your request. If you authorize another person to submit a request on your behalf, you must provide a letter of authorization along with proof of identity for both you and the authorized individual.
          </p>
        </div>
      ),
    },
    {
      id: 'priv-10',
      num: '10',
      title: 'Updates to This Privacy Policy',
      content: (
        <div className="space-y-4 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            <strong>10.1</strong> cliy periodically makes changes to the privacy policy. The terms of this Privacy Policy may change from time to time without prior notice to you, so please check our Privacy Policy periodically for any changes.
          </p>
          <p>
            <strong>10.2</strong> Personal data collected by us will be dealt with in accordance with the provisions of our Privacy Policy which were in effect at the time of collection. Your continued use of our Services following the posting of any changes to this Privacy Policy means you accept such changes.
          </p>
        </div>
      ),
    },
  ], []);

  // ── API Terms Sections ───────────────────────────────────────────────────
  const apiSections: Section[] = useMemo(() => [
    {
      id: 'api-1',
      num: '1',
      title: 'API License and Scope',
      content: (
        <div className="space-y-3 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            cliy grants authorized users and subscribers a limited, non-exclusive, revocable license to access cliy video processing and frame extraction APIs according to the rate limits and quotas assigned to their account tier.
          </p>
        </div>
      ),
    },
    {
      id: 'api-2',
      num: '2',
      title: 'API Rate Limits and Abuse Prevention',
      content: (
        <div className="space-y-3 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            You agree not to bypass API authentication, exceed assigned concurrency or rate limits, reverse engineer internal endpoints, or generate automated requests that disrupt service availability for other users.
          </p>
        </div>
      ),
    },
    {
      id: 'api-3',
      num: '3',
      title: 'API Termination and Modification',
      content: (
        <div className="space-y-3 text-sm leading-relaxed text-[#d1d5db]">
          <p>
            cliy reserves the right to modify, deprecate, or terminate API endpoints or revoke API keys involved in abuse or violations of these Terms.
          </p>
        </div>
      ),
    },
  ], []);

  const currentSections = useMemo(() => {
    if (activeTab === 'privacy') return privacySections;
    if (activeTab === 'api') return apiSections;
    return termsSections;
  }, [activeTab, termsSections, privacySections, apiSections]);

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#d1d5db] flex flex-col font-sans selection:bg-zinc-700 selection:text-white">
      {/* ── Top Fixed Policies Header (Matching Reference Image) ─────── */}
      <header className="border-b border-zinc-800 bg-black px-6 sm:px-12 py-5 flex items-center justify-between flex-wrap gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-8 flex-wrap">
          {/* Main Title */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white select-none">
            Policies
          </h1>

          {/* Navigation Policy Tabs */}
          <nav className="flex items-center gap-6 sm:gap-8 text-sm sm:text-base font-normal">
            <button
              onClick={() => handleTabChange('terms')}
              className={`py-1 relative transition-colors cursor-pointer ${
                activeTab === 'terms'
                  ? 'text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Terms of Service
              {activeTab === 'terms' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-600" />
              )}
            </button>

            <button
              onClick={() => handleTabChange('privacy')}
              className={`py-1 relative transition-colors cursor-pointer ${
                activeTab === 'privacy'
                  ? 'text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Privacy Policy
              {activeTab === 'privacy' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-600" />
              )}
            </button>

            <button
              onClick={() => handleTabChange('api')}
              className={`py-1 relative transition-colors cursor-pointer ${
                activeTab === 'api'
                  ? 'text-white font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              API Terms of Use
              {activeTab === 'api' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-red-600" />
              )}
            </button>
          </nav>
        </div>

        {/* Back Link (Clean single link, no extra studio link) */}
        <div className="flex items-center gap-4 text-xs">
          <Link
            to="/"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ← Return to Home
          </Link>
        </div>
      </header>

      {/* ── Main Two-Column Layout (Wikipedia / Classic Attached Left Sidebar) ── */}
      <div className="w-full max-w-[1440px] mx-auto flex-1 flex flex-col md:flex-row">
        {/* Attached Left Sidebar: Table of Contents */}
        <aside className="w-full md:w-72 lg:w-80 shrink-0 border-b md:border-b-0 md:border-r border-zinc-800 bg-black p-6 md:py-8 md:px-6">
          <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2 space-y-3 text-xs scrollbar-thin scrollbar-thumb-zinc-800">
            <div className="font-bold uppercase tracking-widest text-zinc-400 pb-2 border-b border-zinc-800 text-[11px]">
              Contents
            </div>

            <ol className="space-y-1.5 font-normal text-zinc-400">
              {currentSections.map((sec) => (
                <li key={sec.id}>
                  <button
                    onClick={() => scrollToSection(sec.id)}
                    className={`text-left w-full hover:underline transition-colors block py-0.5 cursor-pointer ${
                      activeSection === sec.id
                        ? 'text-white font-bold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <span className="mr-1.5 text-zinc-500 font-mono">{sec.num}.</span>
                    <span>{sec.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        {/* Right Main Column: Legal Document Content */}
        <main className="flex-1 p-6 sm:p-12 lg:p-16 max-w-4xl space-y-8 bg-black">
          {/* Document Header & Preamble */}
          <div className="space-y-4 pb-6 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 font-mono uppercase tracking-wider">
              {activeTab === 'terms' && 'CLIY / CLIPFLOW TERMS OF SERVICE'}
              {activeTab === 'privacy' && 'CLIY PRIVACY POLICY'}
              {activeTab === 'api' && 'CLIY API TERMS OF USE'}
            </div>

            <div className="text-xs text-zinc-400 font-mono">
              Effective Date: September 20, 2026
            </div>

            {activeTab === 'terms' && (
              <div className="space-y-3 text-sm text-[#d1d5db] leading-relaxed pt-2">
                <p>
                  This Terms of Service Agreement ("Agreement" or "Terms of Service"), effective as of the Effective Date, is entered and made by and between <strong>cliy</strong> ("we", "our" or "us") and you, or the company, organization or other legal entity ("Entity") that you represent ("User" or "you").
                </p>
                <p className="font-semibold text-white uppercase text-xs tracking-wider pt-1">
                  BY ACCESSING, VISITING, DOWNLOADING, COPYING, OR USING THE SERVICE, YOU ACCEPT AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.
                </p>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-3 text-sm text-[#d1d5db] leading-relaxed pt-2">
                <p>
                  This Privacy Policy explains how <strong>cliy</strong> collects, processes, and protects your information when accessing our media tools and services.
                </p>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-3 text-sm text-[#d1d5db] leading-relaxed pt-2">
                <p>
                  These API Terms of Use govern programmatic access to <strong>cliy</strong> media-processing endpoints, metadata parsers, and frame extraction services.
                </p>
              </div>
            )}
          </div>

          {/* Section Items */}
          <div className="space-y-10">
            {currentSections.map((sec) => (
              <section
                key={sec.id}
                id={sec.id}
                className="scroll-mt-24 space-y-3 pb-8 border-b border-zinc-900 last:border-b-0"
              >
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  {sec.num}. {sec.title}
                </h2>
                <div className="text-sm text-[#d1d5db] leading-relaxed">
                  {sec.content}
                </div>
              </section>
            ))}
          </div>

          {/* Document Footer Note */}
          <div className="pt-8 border-t border-zinc-800 text-xs text-zinc-500 font-mono space-y-1">
            <p>© 2026 cliy. All rights reserved.</p>
            <p>cliy · clipflow.cliy.me · clipflovv@gmail.com</p>
          </div>
        </main>
      </div>
    </div>
  );
}
