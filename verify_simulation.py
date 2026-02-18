from playwright.sync_api import sync_playwright
import time

def verify_simulation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to http://localhost:8080")
            page.goto("http://localhost:8080")

            # Wait for some content to load
            print("Waiting for content...")
            # Using a more generic selector or text that should be present
            page.wait_for_selector("body", timeout=30000)

            # Wait a bit more for React to hydrate and render
            time.sleep(5)

            # Take screenshot
            print("Taking screenshot...")
            page.screenshot(path="/home/jules/verification/simulation.png")
            print("Screenshot taken")

        except Exception as e:
            print(f"Error: {e}")
            try:
                page.screenshot(path="/home/jules/verification/error.png")
            except:
                pass
        finally:
            browser.close()

if __name__ == "__main__":
    verify_simulation()
