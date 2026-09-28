import { MigrationInterface, QueryRunner } from 'typeorm';
export class EventContract1790553600000 implements MigrationInterface {
    async up(runner: QueryRunner): Promise<void> {
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_unitActivity\" CHECK (\"unitActivity\" IN ('תע\"ם', 'אימונים', 'הכשרה', 'רגיעה / מנהלה', 'מלחמה/מבצע צבאי נרחב'))");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_personalActivity\" CHECK (\"personalActivity\" IN ('פעילות מבצעית/לחימה', 'אימון', 'הכשרה', 'שגרה', 'פנאי', 'חופשה'))");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_category\" CHECK (\"category\" IN ('נשק ומקלעים', 'דרכים', 'תחמושת', 'ירי דו\"צ', 'מזג-אוויר', 'רק\"מ וצמ\"ה קרביים', 'שת\"פ אוויר', 'עבודה', 'אוויר', 'בטיחות ימי', 'ספורט ואקסטרים', 'נפילות/חבלות', 'חריגות ירי או תנועה של כוחות בשטחי אימונים', 'חומ\"ס', 'אמל\"ח (לא נשק/מקלעים)', 'אש', 'טג\"ח קרבי', 'שת\"פ ים', 'ייעודי עורף/חילוץ והצלה', 'אמצעי רום קרוב לקרקע', 'כושר גופני/קרבי'))");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_location\" CHECK (\"location\" IN ('בסיס', 'שטח אזרחי', 'שטח אש', 'רציף'))");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_eventSeverity\" CHECK (\"eventSeverity\" IN ('קל', 'בינוני', 'חמור'))");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_result\" CHECK (\"result\" IN ('א.נ.א.נ (אין נפגעים, אין נזק)', 'א.נ.י.נ (אין נפגעים, יש נזק)', 'י.נ.א.נ (יש נפגעים, אין נזק)', 'י.נ.י.נ (יש נפגעים, יש נזק)'))");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_injurySeverity\" CHECK (\"injurySeverity\" IN ('ללא פגיעה', 'פגוע קל (ללא אשפוז)', 'פגוע קל (שאושפז)', 'פגוע בינוני', 'פגוע קשה/אנוש', 'חלל', ''))");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT \"domain_weather\" CHECK (\"weather\" IN ('שרב/עומס חום', 'שלג', 'סופת חול', 'גשם', 'ערפל', 'התקרחות', 'ברד', 'מעונן', 'נאה', 'רוח', 'ים סוער', 'מים שקטים'))");
        await runner.query("CREATE INDEX safety_events_page_idx ON safety_events (\"createdAt\" DESC, id DESC)");
        await runner.query("ALTER TABLE safety_events ADD CONSTRAINT event_date_time CHECK (\"eventDate\" ~ '^\\d{4}-\\d{2}-\\d{2}$' AND \"eventDate\"::date >= DATE '0001-01-01' AND \"eventTime\" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')");
    }
    async down(runner: QueryRunner): Promise<void> {
        await runner.query('DROP INDEX safety_events_page_idx');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_unitActivity"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_personalActivity"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_category"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_location"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_eventSeverity"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_result"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_injurySeverity"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT "domain_weather"');
        await runner.query('ALTER TABLE safety_events DROP CONSTRAINT event_date_time');
    }
}
