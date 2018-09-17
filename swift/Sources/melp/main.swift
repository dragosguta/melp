import EventKit
import CommandLineKit

class CalendarReader: NSObject {
    let initialEventStore = EKEventStore()
    
    let cli = CommandLineKit.CommandLine()
    let calendarName = StringOption(shortFlag: "c", longFlag: "calendarName", helpMessage: "The name of the calendar in iCal.")
    let shouldListen = BoolOption(shortFlag: "l", longFlag: "listen", helpMessage: "Add listener for new events in iCal.")

    override init() {
        super.init()
        
        cli.addOptions(calendarName)
        cli.addOptions(shouldListen)
        
        do { try cli.parse() } catch { cli.printUsage(error) }
        
        switch EKEventStore.authorizationStatus(for: EKEntityType.event) {
            case .authorized:
                main(initialEventStore)
            case .denied:
                print("ERROR: Access to iCal application denied.")
                return
            case .notDetermined:
                initialEventStore.requestAccess(to: EKEntityType.event) { (granted, error) in
                    if !granted {
                        print("ERROR: Permission not granted to access iCal application.")
                    } else {
                        self.main(self.initialEventStore)
                    }
                }
            default:
                print("ERROR: Unknown iCal authorization status.")
        }
        
        if self.shouldListen.value { setupListener() }
    }
    
    @objc func updateEvents(_ notification: NSNotification) {
        main(notification.object as! EKEventStore)
    }
    
    func convertNSDatetoString(date: NSDate) -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd HH:mm"
    
        let dateString = dateFormatter.string(from: date as Date)
    
        return dateString
    }
    
    func setupListener() {
        NotificationCenter.default.addObserver(self, selector: #selector(self.updateEvents(_:)), name: NSNotification.Name.EKEventStoreChanged, object: initialEventStore)
        RunLoop.main.run()
    }
    
    func buildEventsList(from store: EKEventStore, calendar: EKCalendar) -> String {
        var eventsList = [String:String]()
        
        let startOfDay = Calendar.current.startOfDay(for: Date())
        
        var components = DateComponents()
        components.day = 1
        components.second = -1
        
        let endOfDay = Calendar.current.date(byAdding: components, to: startOfDay)!
        
        let predicate = store.predicateForEvents(withStart: startOfDay as Date, end: endOfDay, calendars: [calendar])
        let events = store.events(matching: predicate)
        
        for event in events {
            eventsList[event.title] = convertNSDatetoString(date: event.startDate! as NSDate)
        }
        
        let invalidJson = "ERROR: Unable to convert Swift dict to JSON object."
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: eventsList, options: .prettyPrinted)
            return String(bytes: jsonData, encoding: String.Encoding.utf8) ?? invalidJson
        } catch {
            return invalidJson
        }
    }
    
    func main(_ eventStore: EKEventStore) {
        let calendars = eventStore.calendars(for: .event)

        let calName = self.calendarName.value
        
        if calName == nil {
            print("ERROR: Unknown calendar name.")
            return
        }
        
        for calendar in calendars {
            if calendar.title == calName {
                print(buildEventsList(from: eventStore, calendar: calendar))
                fflush(__stdoutp)
                break
            }
        }
    }
}

let calReader = CalendarReader()
